import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import {
  findIllustratorExportPath,
  getIllustratorExportCandidates,
  getEpsPreviewPath,
} from '../utils/eps-preview.js';
import { readEpsMetadata } from '../utils/eps-metadata.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = createLogger('eps-checker');

const JSX_TEMPLATE_PATH = path.join(__dirname, '..', 'scripts', 'checkVector.jsx');
const TIMEOUT_MS = 120_000; // 2 minutes
const MAX_RETRIES = 2;

function buildJsxScript(inputFilePath, outputFilePath, previewFilePath) {
  const template = fs.readFileSync(JSX_TEMPLATE_PATH, 'utf-8');
  const preamble = `var inputFilePath = ${JSON.stringify(inputFilePath)};\nvar outputFilePath = ${JSON.stringify(outputFilePath)};\nvar previewFilePath = ${JSON.stringify(previewFilePath)};\n`;
  return preamble + template;
}

async function runIllustratorScript(jsxContent) {
  // Write JSX to temp file
  const tempJsx = path.join(os.tmpdir(), `eps_check_${uuidv4()}.jsx`);
  fs.writeFileSync(tempJsx, jsxContent, 'utf-8');

  const appleScript = `
    tell application "Adobe Illustrator"
      activate
      do javascript file (POSIX file "${tempJsx}" as string)
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', appleScript], { timeout: TIMEOUT_MS });
  } finally {
    // Cleanup temp JSX
    try { fs.unlinkSync(tempJsx); } catch { /* ignore */ }
  }
}

async function killIllustrator() {
  try {
    await execFileAsync('killall', ['Adobe Illustrator'], { timeout: 5000 });
    log.warn('Force-killed Adobe Illustrator');
    // Wait a bit for process to fully die
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch {
    // Process might not be running
  }
}

export async function checkEps(filePath, rules = {}) {
  const errors = [];
  const warnings = [];
  const info = {};

  log.info(`Checking EPS: ${filePath}`);

  const epsRules = rules.eps || {};
  const outputPath = path.join(os.tmpdir(), `eps_result_${uuidv4()}.json`);
  const previewPath = getEpsPreviewPath(filePath);
  const exportPreviewPath = path.join(os.tmpdir(), `eps_preview_${uuidv4()}.jpg`);

  // Verify file exists
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [{ code: 'FILE_NOT_FOUND', message: 'EPS file not found' }], warnings, info };
  }

  const embeddedMetadata = readEpsMetadata(filePath);
  if (embeddedMetadata.title) info.metadataTitle = embeddedMetadata.title;
  if (embeddedMetadata.description) info.metadataDescription = embeddedMetadata.description;
  if (embeddedMetadata.keywords.length > 0) info.metadataKeywords = embeddedMetadata.keywords;

  let result = null;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.info(`Attempt ${attempt}/${MAX_RETRIES}`);

      const jsxContent = buildJsxScript(filePath, outputPath, exportPreviewPath);
      await runIllustratorScript(jsxContent);

      // Read result file
      if (fs.existsSync(outputPath)) {
        const raw = fs.readFileSync(outputPath, 'utf-8');
        result = JSON.parse(raw);
        break;
      } else {
        throw new Error('Illustrator did not produce output file');
      }
    } catch (err) {
      lastError = err;
      log.error(`Attempt ${attempt} failed`, { error: err.message });

      if (err.killed || err.signal === 'SIGTERM' || err.message.includes('TIMEOUT')) {
        log.warn('Illustrator timed out — killing process');
        await killIllustrator();
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      // Cleanup output file
      try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
    }
  }

  let actualPreviewPath = null;
  if (result && result.previewExported) {
    const exportedPreviewPath = findIllustratorExportPath(exportPreviewPath);
    if (exportedPreviewPath) {
      fs.copyFileSync(exportedPreviewPath, previewPath);
      try { fs.unlinkSync(exportedPreviewPath); } catch { /* ignore */ }
      actualPreviewPath = previewPath;
    }
  }

  for (const candidate of getIllustratorExportCandidates(exportPreviewPath)) {
    try { fs.unlinkSync(candidate); } catch { /* ignore */ }
  }

  if (!result) {
    return {
      valid: false,
      errors: [{ code: 'ILLUSTRATOR_ERROR', message: `Illustrator check failed: ${lastError?.message || 'Unknown error'}` }],
      warnings,
      info,
    };
  }

  if (!result.success) {
    return {
      valid: false,
      errors: [{ code: 'ILLUSTRATOR_SCRIPT_ERROR', message: `Script error: ${result.error}` }],
      warnings,
      info,
    };
  }

  // Map Illustrator results to standard checker output
  info.textFrameCount = result.textFrameCount;
  info.rasterItemCount = result.rasterItemCount;
  info.placedItemCount = result.placedItemCount;
  info.pathItemCount = result.pathItemCount;
  info.compoundPathCount = result.compoundPathCount;
  info.groupCount = result.groupCount;
  info.layerCount = result.layerCount;
  info.artboardWidth = result.artboardWidth;
  info.artboardHeight = result.artboardHeight;
  info.colorMode = result.colorMode;
  info.strayObjectCount = result.strayObjectCount;
  info.fileSize = result.fileSize;
  
  if (actualPreviewPath) {
    info.previewPath = actualPreviewPath;
  }

  // Check: live text
  if (epsRules.requireOutlinedText && result.textFrameCount > 0) {
    errors.push({
      code: 'LIVE_TEXT',
      message: `Live text detected (${result.textFrameCount} text frame${result.textFrameCount > 1 ? 's' : ''} — must be outlined)`,
    });
  }

  // Check: embedded raster
  if (!epsRules.allowEmbeddedRaster && result.rasterItemCount > 0) {
    errors.push({
      code: 'EMBEDDED_RASTER',
      message: `Embedded raster found (${result.rasterItemCount} raster item${result.rasterItemCount > 1 ? 's' : ''})`,
    });
  }

  // Check: placed/linked items
  if (!epsRules.allowPlacedItems && result.placedItemCount > 0) {
    warnings.push({
      code: 'PLACED_ITEMS',
      message: `Linked/placed items found (${result.placedItemCount}) — may cause missing assets`,
    });
  }

  // Check: stray objects
  if (epsRules.requireObjectsInArtboard && result.strayObjectCount > 0) {
    warnings.push({
      code: 'STRAY_OBJECTS',
      message: `${result.strayObjectCount} object${result.strayObjectCount > 1 ? 's' : ''} found outside artboard bounds`,
    });
  }

  // Check: color mode
  if (epsRules.requireRGB && result.colorMode !== 'RGB') {
    errors.push({ code: 'WRONG_COLOR_MODE', message: `Color mode is ${result.colorMode}, platform requires RGB` });
  }
  if (epsRules.requireCMYK && result.colorMode !== 'CMYK') {
    errors.push({ code: 'WRONG_COLOR_MODE', message: `Color mode is ${result.colorMode}, platform requires CMYK` });
  }

  const valid = errors.length === 0;
  log.info(`EPS check complete: ${valid ? 'PASS' : 'FAIL'}`, { errors: errors.length, warnings: warnings.length });

  return { valid, errors, warnings, info };
}
