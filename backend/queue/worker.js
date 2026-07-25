import { Worker, Queue, FlowProducer } from 'bullmq';
import fs from 'fs';
import dotenv from 'dotenv';
import { REDIS_CONFIG } from './connection.js';
import { checkSvg } from '../checkers/svg.js';
import { checkJpg } from '../checkers/jpg.js';
import { checkEps } from '../checkers/eps.js';
import { checkAiContent } from '../checkers/ai-content.js';
import { checkCross } from '../checkers/cross-check.js';
import { getRules } from '../rules/loader.js';
import {
  getAsset,
  updateAssetStatus,
  insertCheckResult,
  getCheckResults,
  getAssetsByPairGroup,
  addAssetLog,
} from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import { findEpsPreviewPath } from '../utils/eps-preview.js';

dotenv.config();

const log = createLogger('worker');

// --- Queues (for adding dependent jobs) ---

const aiCheckQueue = new Queue('ai-check', { connection: REDIS_CONFIG });
const crossCheckQueue = new Queue('cross-check', { connection: REDIS_CONFIG });

// --- Worker: SVG Check ---

const svgWorker = new Worker('svg-check', async (job) => {
  const { assetId } = job.data;
  log.info(`[SVG] Processing asset ${assetId}`);

  const asset = getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  updateAssetStatus(assetId, 'processing');
  addAssetLog(assetId, 'Starting SVG technical validation');

  const rules = getRules(asset.platform);
  const result = await checkSvg(asset.file_path, rules);

  insertCheckResult({
    id: uuidv4(),
    assetId,
    checkerType: 'svg',
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    info: result.info,
  });

  addAssetLog(assetId, 'SVG technical validation complete');
  updateAssetStatus(assetId, 'done');
  return result;
}, {
  connection: REDIS_CONFIG,
  concurrency: 5,
});

// --- Worker: JPG Check ---

const jpgWorker = new Worker('jpg-check', async (job) => {
  const { assetId, forceAiRefresh = false } = job.data;
  log.info(`[JPG] Processing asset ${assetId}`);

  const asset = getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  updateAssetStatus(assetId, 'processing');
  addAssetLog(assetId, 'Starting JPG technical validation');

  const rules = getRules(asset.platform);
  const result = await checkJpg(asset.file_path, rules);

  insertCheckResult({
    id: uuidv4(),
    assetId,
    checkerType: 'jpg',
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    info: result.info,
  });
  
  addAssetLog(assetId, 'JPG technical validation complete');

  // Trigger AI content check after JPG check
  const aiRules = rules.aiContent || {};
  const shouldRunAi = aiRules.checkTrademark || aiRules.checkSensitiveContent || aiRules.suggestKeywords;
  if (shouldRunAi) {
    await aiCheckQueue.add(
      'ai-check',
      { assetId, forceRefresh: forceAiRefresh },
      { jobId: `ai-${assetId}-${Date.now()}` },
    );
    addAssetLog(assetId, 'Technical check complete. Waiting for AI content analysis');
    log.info(`[JPG] Enqueued AI check for ${assetId}`);
  }

  // Check if cross-check should run (if pair exists and EPS is done)
  if (asset.pair_group) {
    await tryEnqueueCrossCheck(asset.pair_group);
  }

  if (!shouldRunAi) {
    updateAssetStatus(assetId, 'done');
  }
  return result;
}, {
  connection: REDIS_CONFIG,
  concurrency: 5,
});

// --- Worker: EPS Check ---

const epsWorker = new Worker('eps-check', async (job) => {
  const { assetId, forceAiRefresh = false } = job.data;
  log.info(`[EPS] Processing asset ${assetId}`);

  const asset = getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  updateAssetStatus(assetId, 'processing');
  addAssetLog(assetId, 'Starting EPS technical validation (via Illustrator)');

  const rules = getRules(asset.platform);
  const result = await checkEps(asset.file_path, rules);
  const previewPath = result.info.previewPath || findEpsPreviewPath(asset.file_path);

  if (previewPath) {
    result.info.previewPath = previewPath;
  }

  insertCheckResult({
    id: uuidv4(),
    assetId,
    checkerType: 'eps',
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    info: result.info,
  });

  addAssetLog(assetId, 'EPS technical validation complete');

  // Trigger AI content check using the generated JPG preview
  const aiRules = rules.aiContent || {};
  const aiEnabled = aiRules.checkTrademark || aiRules.checkSensitiveContent || aiRules.suggestKeywords;
  const shouldRunAi = Boolean(previewPath) && aiEnabled;
  if (shouldRunAi) {
    await aiCheckQueue.add(
      'ai-check',
      { assetId, previewPath, forceRefresh: forceAiRefresh },
      { jobId: `ai-${assetId}-${Date.now()}` },
    );
    addAssetLog(assetId, 'Technical check complete. Waiting for AI content analysis');
    log.info(`[EPS] Enqueued AI check for ${assetId} using generated preview`);
  } else if (aiEnabled) {
    addAssetLog(assetId, 'AI content analysis skipped because no EPS preview was found');
    log.warn(`[EPS] AI check skipped for ${assetId}: preview not found`);
  }

  // Check if cross-check should run
  if (asset.pair_group) {
    await tryEnqueueCrossCheck(asset.pair_group);
  }

  if (!shouldRunAi) {
    updateAssetStatus(assetId, 'done');
  }
  return result;
}, {
  connection: REDIS_CONFIG,
  concurrency: 1, // Illustrator single-instance
});

// --- Worker: AI Content Check ---

const aiWorker = new Worker('ai-check', async (job) => {
  const { assetId, previewPath, forceRefresh = false } = job.data;
  log.info(`[AI] Processing asset ${assetId}`);

  const asset = getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  addAssetLog(assetId, 'Starting AI Content check with Gemini Vision');

  const rules = getRules(asset.platform);
  const targetPath = previewPath || asset.file_path;
  
  const result = await checkAiContent(targetPath, rules, { forceRefresh });

  insertCheckResult({
    id: uuidv4(),
    assetId,
    checkerType: 'ai_content',
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    info: result.info,
  });
  
  addAssetLog(assetId, 'AI Content check complete');
  updateAssetStatus(assetId, 'done');

  return result;
}, {
  connection: REDIS_CONFIG,
  concurrency: 2,
  limiter: {
    max: 10,
    duration: 60_000, // 10 requests per minute
  },
});

// --- Worker: Cross Check ---

const crossCheckWorker = new Worker('cross-check', async (job) => {
  const { pairGroup } = job.data;
  log.info(`[CROSS] Processing pair group: ${pairGroup}`);

  const assets = getAssetsByPairGroup(pairGroup);
  const epsAsset = assets.find((a) => a.file_type === 'eps');
  const jpgAsset = assets.find((a) => a.file_type === 'jpg');

  if (!epsAsset || !jpgAsset) {
    log.warn(`[CROSS] Incomplete pair for group ${pairGroup}`);
    return null;
  }
  
  addAssetLog(epsAsset.id, 'Starting EPS↔JPG Cross-Check');
  addAssetLog(jpgAsset.id, 'Starting EPS↔JPG Cross-Check');

  const epsResults = getCheckResults(epsAsset.id);
  const jpgResults = getCheckResults(jpgAsset.id);
  const epsCheck = epsResults.find((r) => r.checker_type === 'eps');
  const jpgCheck = jpgResults.find((r) => r.checker_type === 'jpg');

  if (!epsCheck || !jpgCheck) {
    log.warn(`[CROSS] Missing check results for pair ${pairGroup}`);
    return null;
  }

  const result = checkCross(epsCheck, jpgCheck);

  // Store cross-check result under both assets
  for (const asset of [epsAsset, jpgAsset]) {
    insertCheckResult({
      id: uuidv4(),
      assetId: asset.id,
      checkerType: 'cross_check',
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      info: result.info,
    });
  }
  
  addAssetLog(epsAsset.id, 'Cross-Check complete');
  addAssetLog(jpgAsset.id, 'Cross-Check complete');

  return result;
}, {
  connection: REDIS_CONFIG,
  concurrency: 3,
});

// --- Helpers ---

async function tryEnqueueCrossCheck(pairGroup) {
  const assets = getAssetsByPairGroup(pairGroup);
  const epsAsset = assets.find((a) => a.file_type === 'eps');
  const jpgAsset = assets.find((a) => a.file_type === 'jpg');

  if (!epsAsset || !jpgAsset) return;

  // Check if both have their primary results
  const epsResults = getCheckResults(epsAsset.id);
  const jpgResults = getCheckResults(jpgAsset.id);
  const hasEpsCheck = epsResults.some((r) => r.checker_type === 'eps');
  const hasJpgCheck = jpgResults.some((r) => r.checker_type === 'jpg');

  if (hasEpsCheck && hasJpgCheck) {
    const epsCheck = epsResults.findLast((result) => result.checker_type === 'eps');
    const jpgCheck = jpgResults.findLast((result) => result.checker_type === 'jpg');
    const checkVersion = Math.max(Date.parse(`${epsCheck.created_at}Z`), Date.parse(`${jpgCheck.created_at}Z`));

    await crossCheckQueue.add('cross-check', { pairGroup }, {
      jobId: `cross-${pairGroup}-${checkVersion}`,
      delay: 1000, // Small delay to ensure DB writes are committed
    });
    addAssetLog(epsAsset.id, 'Enqueued for EPS↔JPG Cross-Check');
    addAssetLog(jpgAsset.id, 'Enqueued for EPS↔JPG Cross-Check');
    log.info(`[CROSS] Enqueued cross-check for pair: ${pairGroup}`);
  }
}

// --- Error handlers ---

for (const [name, worker] of Object.entries({ svgWorker, jpgWorker, epsWorker, aiWorker, crossCheckWorker })) {
  worker.on('failed', (job, err) => {
    log.error(`${name} job ${job?.id} failed`, { error: err.message });
    if (job?.data?.assetId && getAsset(job.data.assetId)) {
      updateAssetStatus(job.data.assetId, 'error');
      addAssetLog(job.data.assetId, `Check failed: ${err.message}`);
    }
  });

  worker.on('error', (err) => {
    log.error(`${name} error`, { error: err.message });
  });
}

log.info('All workers started');
log.info('Queue config: SVG(5), JPG(5), EPS(1), AI(2, 10/min), Cross(3)');
