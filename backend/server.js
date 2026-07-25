import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import { REDIS_CONFIG } from './queue/connection.js';
import {
  insertAsset,
  getAsset,
  getAllAssets,
  deleteAsset,
  deleteAllAssets,
  getCheckResults,
  getJobsWithResults,
  addAssetLog,
  resetAssetForRecheck,
  updateAssetMetadataCategories,
} from './db/database.js';
import { getAvailablePlatforms, getRules } from './rules/loader.js';
import { createLogger } from './utils/logger.js';
import {
  findEpsPreviewPath,
  getEpsPreviewCandidates,
} from './utils/eps-preview.js';
import { validateSelectedCategories } from './utils/stock-metadata.js';

dotenv.config();

const log = createLogger('server');
const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

// Ensure upload directory
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Middleware ---

app.use(cors());
app.use(express.json());

// --- Multer config ---

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_EXTENSIONS = ['.svg', '.eps', '.jpg', '.jpeg'];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB per file
});

// --- BullMQ Queues ---

const queues = {
  svg: new Queue('svg-check', { connection: REDIS_CONFIG }),
  jpg: new Queue('jpg-check', { connection: REDIS_CONFIG }),
  eps: new Queue('eps-check', { connection: REDIS_CONFIG }),
};

// --- Routes ---

// Health check
app.get('/api/health', async (req, res) => {
  let redisOk = false;
  try {
    const IORedis = (await import('ioredis')).default;
    const redis = new IORedis(REDIS_CONFIG);
    const pong = await redis.ping();
    redisOk = pong === 'PONG';
    redis.disconnect();
  } catch { /* Redis not available */ }

  res.json({
    status: 'ok',
    redis: redisOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// List available platforms
app.get('/api/platforms', (req, res) => {
  res.json(getAvailablePlatforms());
});

// Upload files
app.post('/api/upload', upload.array('files', 100), async (req, res) => {
  try {
    const platform = req.body.platform || 'shutterstock';
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const assets = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const fileType = ext === '.jpeg' ? 'jpg' : ext.slice(1); // normalize .jpeg to jpg
      const baseName = path.basename(file.originalname, ext).toLowerCase();
      const id = uuidv4();

      const asset = {
        id,
        originalName: file.originalname,
        filePath: file.path,
        fileType,
        fileSize: file.size,
        platform,
        pairGroup: baseName, // Group by base filename for EPS↔JPG pairing
      };

      insertAsset(asset);
      addAssetLog(id, 'File uploaded and saved');

      // Enqueue to appropriate checker
      const queueName = fileType === 'jpg' ? 'jpg' : fileType;
      if (queues[queueName]) {
        await queues[queueName].add(`${fileType}-check`, { assetId: id }, { jobId: `${fileType}-${id}` });
        addAssetLog(id, `Enqueued in ${fileType.toUpperCase()} worker queue`);
        log.info(`Enqueued ${fileType} check for ${file.originalname}`, { assetId: id });
      }

      assets.push({ id, originalName: file.originalname, fileType, pairGroup: baseName });
    }

    res.json({ success: true, count: assets.length, assets });
  } catch (err) {
    log.error('Upload error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// List all jobs with results
app.get('/api/jobs', (req, res) => {
  const jobs = getJobsWithResults();
  res.json(jobs);
});

// Get single job detail
app.get('/api/jobs/:id', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const results = getCheckResults(req.params.id);

  const hasErrors = results.some((r) => r.errors.length > 0);
  const hasWarnings = results.some((r) => r.warnings.length > 0);
  const rules = getRules(asset.platform);

  res.json({
    ...asset,
    results,
    metadata_options: {
      image_categories: rules.metadata?.imageCategories || [],
      max_categories: rules.metadata?.categoryMaxCount || 2,
      platform_label: rules.label,
    },
    overallResult: asset.status === 'done' ? (hasErrors ? 'fail' : hasWarnings ? 'warning' : 'pass') : null,
  });
});

app.patch('/api/jobs/:id/metadata-categories', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (asset.file_type !== 'eps') {
    return res.status(400).json({ error: 'Category settings are currently available for EPS files only' });
  }

  if (asset.status !== 'done') {
    return res.status(409).json({ error: 'Wait until all EPS checks are complete' });
  }

  const validation = validateSelectedCategories(req.body.categories, getRules(asset.platform));
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  updateAssetMetadataCategories(asset.id, validation.categories);
  addAssetLog(asset.id, `Metadata categories saved: ${validation.categories.join(', ')}`);

  return res.json({ success: true, categories: validation.categories });
});

// Serve uploaded file for preview
app.get('/api/jobs/:id/file', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (!fs.existsSync(asset.file_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const ext = path.extname(asset.file_path).toLowerCase();
  const mimeTypes = {
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.eps': 'application/postscript',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.sendFile(path.resolve(asset.file_path));
});

app.get('/api/jobs/:id/preview', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const previewPath = asset.file_type === 'eps'
    ? findEpsPreviewPath(asset.file_path)
    : asset.file_path;

  if (!previewPath || !fs.existsSync(previewPath)) {
    return res.status(404).json({ error: 'Preview not found on disk' });
  }

  const ext = path.extname(previewPath).toLowerCase();
  const mimeTypes = {
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.sendFile(path.resolve(previewPath));
});

app.delete('/api/jobs', (req, res) => {
  const assets = getAllAssets();

  for (const asset of assets) {
    try { fs.unlinkSync(asset.file_path); } catch { /* file may already be gone */ }
    for (const previewPath of getEpsPreviewCandidates(asset.file_path)) {
      try { fs.unlinkSync(previewPath); } catch { /* preview may not exist */ }
    }
  }

  const result = deleteAllAssets();
  res.json({ success: true, deletedCount: result.changes });
});

// Delete a job and its file
app.delete('/api/jobs/:id', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Remove file from disk
  try { fs.unlinkSync(asset.file_path); } catch { /* file may already be gone */ }
  for (const previewPath of getEpsPreviewCandidates(asset.file_path)) {
    try { fs.unlinkSync(previewPath); } catch { /* preview may not exist */ }
  }

  deleteAsset(req.params.id);
  res.json({ success: true });
});

// Recheck a job
app.post('/api/jobs/:id/recheck', async (req, res) => {
  try {
    const asset = getAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Job not found' });
    }

    resetAssetForRecheck(asset.id);

    const fileType = asset.file_type;
    const queueName = fileType === 'jpg' ? 'jpg' : fileType;
    if (queues[queueName]) {
      // Use timestamp in jobId to prevent BullMQ from deduplicating the job if we recheck quickly
      await queues[queueName].add(
        `${fileType}-check`,
        { assetId: asset.id, forceAiRefresh: true },
        { jobId: `${fileType}-${asset.id}-${Date.now()}` },
      );
      addAssetLog(asset.id, `Re-enqueued in ${fileType.toUpperCase()} worker queue for recheck`);
      log.info(`Recheck requested for ${asset.original_name}`, { assetId: asset.id });
    }

    res.json({ success: true });
  } catch (err) {
    log.error('Recheck error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// --- Error handling ---

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  log.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: err.message });
});

// --- Start ---

app.listen(PORT, () => {
  log.info(`Server running on http://localhost:${PORT}`);
  log.info(`Upload directory: ${UPLOAD_DIR}`);
});
