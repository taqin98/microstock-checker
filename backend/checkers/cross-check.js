import { createLogger } from '../utils/logger.js';

const log = createLogger('cross-check');

const ASPECT_RATIO_TOLERANCE = 0.02; // 2%

export function checkCross(epsResult, jpgResult) {
  const errors = [];
  const warnings = [];
  const info = {};

  log.info('Running cross-check EPS↔JPG');

  const epsInfo = epsResult?.info || {};
  const jpgInfo = jpgResult?.info || {};

  // Aspect ratio comparison
  if (epsInfo.artboardWidth && epsInfo.artboardHeight && jpgInfo.width && jpgInfo.height) {
    const epsRatio = epsInfo.artboardWidth / epsInfo.artboardHeight;
    const jpgRatio = jpgInfo.width / jpgInfo.height;
    const diff = Math.abs(epsRatio - jpgRatio) / epsRatio;

    info.epsAspectRatio = Math.round(epsRatio * 1000) / 1000;
    info.jpgAspectRatio = Math.round(jpgRatio * 1000) / 1000;
    info.aspectRatioDiff = Math.round(diff * 10000) / 100; // percentage

    if (diff > ASPECT_RATIO_TOLERANCE) {
      warnings.push({
        code: 'ASPECT_RATIO_MISMATCH',
        message: `Aspect ratio mismatch — EPS: ${info.epsAspectRatio}, JPG: ${info.jpgAspectRatio} (${info.aspectRatioDiff}% difference)`,
      });
    }
  } else {
    warnings.push({
      code: 'INCOMPLETE_DATA',
      message: 'Could not compare aspect ratios — missing dimension data from EPS or JPG check',
    });
  }

  const valid = errors.length === 0;
  log.info(`Cross-check complete: ${valid ? 'PASS' : 'FAIL'}`, { warnings: warnings.length });

  return { valid, errors, warnings, info };
}
