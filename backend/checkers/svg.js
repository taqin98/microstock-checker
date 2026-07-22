import fs from 'fs';
import sax from 'sax';
import { createLogger } from '../utils/logger.js';

const log = createLogger('svg-checker');

function parseDimensions(attributes) {
  // SVG attributes are case-sensitive but sax-js might lower them depending on strictness.
  // We'll check variations.
  const viewBox = attributes['viewBox'] || attributes['viewbox'];
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  const width = parseFloat(attributes['width']);
  const height = parseFloat(attributes['height']);
  if (!isNaN(width) && !isNaN(height)) {
    return { x: 0, y: 0, width, height };
  }

  return null;
}

export function checkSvg(filePath, rules = {}) {
  return new Promise((resolve) => {
    const errors = [];
    const warnings = [];
    const info = { pathCount: 0, textElementCount: 0, rasterElementCount: 0 };
    
    log.info(`Checking SVG: ${filePath}`);
    const svgRules = rules.svg || {};

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (err) {
      log.error('Failed to read file', { error: err.message });
      return resolve({ valid: false, errors: [{ code: 'READ_ERROR', message: `Cannot read file: ${err.message}` }], warnings, info });
    }
    
    info.fileSize = stats.size;
    info.fileSizeKB = Math.round(stats.size / 1024);

    let hasSvgRoot = false;
    let isCorrupt = false;
    let errorMessage = '';
    let finished = false;

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const saxStream = sax.createStream(true, { trim: true, normalize: true }); // strict = true

    saxStream.on('error', (e) => {
      isCorrupt = true;
      errorMessage = e.message.split('\n')[0]; // Get first line of error
      // Prevent further parsing and close stream to avoid memory leak
      saxStream._parser.error = null; 
      saxStream._parser.resume();
      stream.destroy();
      finishCheck();
    });

    saxStream.on('opentag', (node) => {
      const name = node.name.toLowerCase().replace(/^.*:/, ''); // strip namespaces like svg:path -> path

      if (name === 'svg' && !hasSvgRoot) {
        hasSvgRoot = true;
        const dims = parseDimensions(node.attributes);
        if (dims) {
          info.viewBox = dims;
          info.width = dims.width;
          info.height = dims.height;
        }
      } else if (name === 'path') {
        info.pathCount++;
      } else if (name === 'text' || name === 'tspan') {
        info.textElementCount++;
      } else if (name === 'image') {
        info.rasterElementCount++;
      }
    });

    saxStream.on('end', () => {
      finishCheck();
    });

    stream.on('error', (err) => {
      log.error('Stream error', { error: err.message });
      if (!finished) {
        finished = true;
        resolve({ valid: false, errors: [{ code: 'READ_ERROR', message: `Cannot read file: ${err.message}` }], warnings, info });
      }
    });

    stream.pipe(saxStream);

    function finishCheck() {
      if (finished) return;
      finished = true;

      if (isCorrupt) {
        return resolve({ 
          valid: false, 
          errors: [{ code: 'INVALID_XML', message: `File corrupt / invalid XML: ${errorMessage}` }], 
          warnings, 
          info 
        });
      }

      if (!hasSvgRoot) {
        return resolve({ valid: false, errors: [{ code: 'NO_SVG_ROOT', message: 'No <svg> root element found' }], warnings, info });
      }

      // Live text
      if (info.textElementCount > 0) {
        if (svgRules.requireOutlinedText !== false) {
          errors.push({
            code: 'LIVE_TEXT',
            message: `Live text detected (${info.textElementCount} text element(s) found — must be outlined to paths)`,
          });
        }
      }

      // Embedded raster
      if (info.rasterElementCount > 0) {
        if (svgRules.allowEmbeddedRaster !== true) {
          errors.push({
            code: 'EMBEDDED_RASTER',
            message: `Embedded/linked raster image found (${info.rasterElementCount} <image> element(s))`,
          });
        }
      }

      // Dimensions
      if (info.width && info.height) {
        const minW = svgRules.minWidth || 0;
        const minH = svgRules.minHeight || 0;
        if (info.width < minW || info.height < minH) {
          warnings.push({
            code: 'SMALL_DIMENSIONS',
            message: `Dimensions ${info.width}×${info.height} below recommended minimum ${minW}×${minH}`,
          });
        }
      } else {
        warnings.push({ code: 'NO_VIEWBOX', message: 'No viewBox or width/height attributes found' });
      }

      // Path count
      const maxPaths = svgRules.maxPathCount || 50000;
      if (info.pathCount > maxPaths) {
        warnings.push({
          code: 'EXCESSIVE_PATHS',
          message: `Excessive path count (${info.pathCount.toLocaleString()}) — possible auto-trace artifact (threshold: ${maxPaths.toLocaleString()})`,
        });
      }

      const valid = errors.length === 0;
      log.info(`SVG check complete: ${valid ? 'PASS' : 'FAIL'}`, { errors: errors.length, warnings: warnings.length });

      resolve({ valid, errors, warnings, info });
    }
  });
}
