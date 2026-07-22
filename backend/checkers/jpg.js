import fs from 'fs';
import sharp from 'sharp';
import { createLogger } from '../utils/logger.js';

const log = createLogger('jpg-checker');

export async function checkJpg(filePath, rules = {}) {
  const errors = [];
  const warnings = [];
  const info = {};

  log.info(`Checking JPG: ${filePath}`);

  const jpgRules = rules.jpg || {};

  // File stats
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    log.error('Failed to stat file', { error: err.message });
    return { valid: false, errors: [{ code: 'READ_ERROR', message: `Cannot read file: ${err.message}` }], warnings, info };
  }

  info.fileSize = stats.size;
  info.fileSizeMB = Math.round((stats.size / (1024 * 1024)) * 100) / 100;

  // Read metadata via sharp
  let metadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch (err) {
    log.error('Sharp metadata failed', { error: err.message });
    return { valid: false, errors: [{ code: 'CORRUPT_FILE', message: `File corrupt / unreadable: ${err.message}` }], warnings, info };
  }

  // Validate format
  if (metadata.format !== 'jpeg') {
    errors.push({ code: 'NOT_JPEG', message: `Not a valid JPEG file (detected format: ${metadata.format})` });
  }

  info.width = metadata.width;
  info.height = metadata.height;
  info.colorSpace = metadata.space;
  info.channels = metadata.channels;
  info.density = metadata.density;
  info.format = metadata.format;
  info.hasAlpha = metadata.hasAlpha;

  // Minimum resolution
  const minW = jpgRules.minWidth || 0;
  const minH = jpgRules.minHeight || 0;
  if (minW > 0 || minH > 0) {
    // Check the shorter side against min requirement (most platforms require minimum on the shorter side)
    const shorter = Math.min(metadata.width, metadata.height);
    const longer = Math.max(metadata.width, metadata.height);
    if (metadata.width < minW && metadata.height < minH) {
      errors.push({
        code: 'LOW_RESOLUTION',
        message: `Resolution too low (${metadata.width}×${metadata.height}, minimum ${minW}×${minH})`,
      });
    } else if (metadata.width < minW || metadata.height < minH) {
      warnings.push({
        code: 'PARTIAL_LOW_RES',
        message: `One dimension below minimum (${metadata.width}×${metadata.height}, recommended ${minW}×${minH})`,
      });
    }
  }

  // Color space must be RGB
  if (jpgRules.mustBeRGB) {
    const rgbSpaces = ['srgb', 'rgb', 'rgb16'];
    if (!rgbSpaces.includes(metadata.space)) {
      errors.push({
        code: 'NOT_RGB',
        message: `Color space is "${metadata.space}", must be RGB`,
      });
    }
  }

  // Max file size
  const maxMB = jpgRules.maxFileSizeMB || 0;
  if (maxMB > 0 && info.fileSizeMB > maxMB) {
    warnings.push({
      code: 'FILE_TOO_LARGE',
      message: `File size ${info.fileSizeMB}MB exceeds recommended maximum ${maxMB}MB`,
    });
  }

  const valid = errors.length === 0;
  log.info(`JPG check complete: ${valid ? 'PASS' : 'FAIL'}`, { errors: errors.length, warnings: warnings.length });

  return { valid, errors, warnings, info };
}
