import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'microstock.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// Migrate existing db to add process_logs if missing
try {
  db.exec("ALTER TABLE assets ADD COLUMN process_logs TEXT DEFAULT '[]'");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE assets ADD COLUMN metadata_categories TEXT DEFAULT '[]'");
} catch (e) {
  // Column already exists
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hydrateAsset(row) {
  if (!row) return null;

  return {
    ...row,
    process_logs: parseJsonArray(row.process_logs),
    metadata_categories: parseJsonArray(row.metadata_categories),
  };
}

// --- Asset helpers ---

export function insertAsset({ id, originalName, filePath, fileType, fileSize, platform, pairGroup }) {
  const stmt = db.prepare(`
    INSERT INTO assets (id, original_name, file_path, file_type, file_size, platform, pair_group)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(id, originalName, filePath, fileType, fileSize, platform, pairGroup);
}

export function getAsset(id) {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  return hydrateAsset(row);
}

export function getAllAssets() {
  return db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all().map(hydrateAsset);
}

export function updateAssetStatus(id, status) {
  return db.prepare('UPDATE assets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
}

export function updateAssetMetadataCategories(id, categories) {
  return db.prepare(`
    UPDATE assets
    SET metadata_categories = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(categories), id);
}

export function addAssetLog(id, message) {
  const row = db.prepare('SELECT process_logs FROM assets WHERE id = ?').get(id);
  if (!row) return;
  const logs = row.process_logs ? JSON.parse(row.process_logs) : [];
  logs.push({ timestamp: new Date().toISOString(), message });
  db.prepare('UPDATE assets SET process_logs = ? WHERE id = ?').run(JSON.stringify(logs), id);
}

export function deleteAsset(id) {
  return db.prepare('DELETE FROM assets WHERE id = ?').run(id);
}

export function deleteAllAssets() {
  return db.prepare('DELETE FROM assets').run();
}

export function resetAssetForRecheck(id) {
  db.prepare('DELETE FROM check_results WHERE asset_id = ?').run(id);
  db.prepare("UPDATE assets SET status = 'pending', process_logs = '[]', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

export function getAssetsByPairGroup(pairGroup) {
  return db.prepare('SELECT * FROM assets WHERE pair_group = ?').all(pairGroup).map(hydrateAsset);
}

// --- Check result helpers ---

export function insertCheckResult({ id, assetId, checkerType, valid, errors, warnings, info }) {
  const stmt = db.prepare(`
    INSERT INTO check_results (id, asset_id, checker_type, valid, errors, warnings, info)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    id,
    assetId,
    checkerType,
    valid ? 1 : 0,
    JSON.stringify(errors || []),
    JSON.stringify(warnings || []),
    JSON.stringify(info || {})
  );
}

export function getCheckResults(assetId) {
  const rows = db.prepare('SELECT * FROM check_results WHERE asset_id = ? ORDER BY created_at').all(assetId);
  return rows.map((row) => ({
    ...row,
    valid: !!row.valid,
    errors: JSON.parse(row.errors),
    warnings: JSON.parse(row.warnings),
    info: JSON.parse(row.info),
  }));
}

// --- AI cache helpers ---

export function getAiCache(fileHash) {
  const row = db.prepare('SELECT * FROM ai_cache WHERE file_hash = ?').get(fileHash);
  if (row) {
    row.result = JSON.parse(row.result);
  }
  return row;
}

export function setAiCache({ fileHash, result, provider, model }) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ai_cache (file_hash, result, provider, model)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(fileHash, JSON.stringify(result), provider, model);
}

// --- AI usage helpers ---

export function getAiUsageToday() {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare('SELECT call_count FROM ai_usage WHERE date = ?').get(today);
  return row ? row.call_count : 0;
}

export function incrementAiUsage() {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO ai_usage (date, call_count) VALUES (?, 1)
    ON CONFLICT(date) DO UPDATE SET call_count = call_count + 1
  `).run(today);
}

// --- Aggregated job view ---

export function getJobsWithResults() {
  const assets = db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all();
  const resultsStmt = db.prepare('SELECT * FROM check_results WHERE asset_id = ?');

  return assets.map((asset) => {
    const hydratedAsset = hydrateAsset(asset);
    const results = resultsStmt.all(asset.id).map((r) => ({
      ...r,
      valid: !!r.valid,
      errors: JSON.parse(r.errors),
      warnings: JSON.parse(r.warnings),
      info: JSON.parse(r.info),
    }));

    const hasErrors = results.some((r) => r.errors.length > 0);
    const hasWarnings = results.some((r) => r.warnings.length > 0);
    const overallResult = hasErrors ? 'fail' : hasWarnings ? 'warning' : 'pass';

    return {
      ...hydratedAsset,
      results,
      overallResult: asset.status === 'done' ? overallResult : null,
    };
  });
}

export default db;
