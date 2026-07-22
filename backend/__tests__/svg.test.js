import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkSvg } from '../checkers/svg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '..', 'test-fixtures');

const defaultRules = {
  svg: {
    requireOutlinedText: true,
    allowEmbeddedRaster: false,
    minWidth: 400,
    minHeight: 400,
    maxPathCount: 50000,
  },
};

describe('SVG Checker', () => {
  it('should pass a valid SVG', async () => {
    const result = await checkSvg(path.join(fixtures, 'valid.svg'), defaultRules);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.info.pathCount >= 0);
    assert.ok(result.info.width > 0);
  });

  it('should detect live text in SVG', async () => {
    const result = await checkSvg(path.join(fixtures, 'has-text.svg'), defaultRules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'LIVE_TEXT'));
  });

  it('should detect embedded raster in SVG', async () => {
    const result = await checkSvg(path.join(fixtures, 'has-image.svg'), defaultRules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'EMBEDDED_RASTER'));
  });

  it('should detect corrupt SVG', async () => {
    const result = await checkSvg(path.join(fixtures, 'corrupt.svg'), defaultRules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('should warn on small dimensions', async () => {
    const result = await checkSvg(path.join(fixtures, 'valid.svg'), {
      svg: { ...defaultRules.svg, minWidth: 2000, minHeight: 2000 },
    });
    assert.ok(result.warnings.some((w) => w.code === 'SMALL_DIMENSIONS'));
  });
});
