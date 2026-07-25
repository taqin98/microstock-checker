import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  findEpsPreviewPath,
  getEpsPreviewCandidates,
  getEpsPreviewPath,
  getIllustratorExportCandidates,
} from '../utils/eps-preview.js';

describe('EPS preview paths', () => {
  it('returns the canonical preview path when it exists', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-preview-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    const epsPath = path.join(directory, 'Harvest Basket.eps');
    const previewPath = getEpsPreviewPath(epsPath);
    fs.writeFileSync(previewPath, 'preview');

    assert.equal(findEpsPreviewPath(epsPath), previewPath);
  });

  it('finds a preview whose spaces were replaced by Illustrator', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-preview-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    const epsPath = path.join(directory, 'Harvest Basket.eps');
    const normalizedPreviewPath = path.join(directory, 'Harvest-Basket.eps.preview.jpg');
    fs.writeFileSync(normalizedPreviewPath, 'preview');

    assert.equal(findEpsPreviewPath(epsPath), normalizedPreviewPath);
  });

  it('includes Illustrator suffix variants', () => {
    const candidates = getIllustratorExportCandidates('/tmp/Harvest Basket.eps.preview.jpg');

    assert.ok(candidates.includes('/tmp/Harvest-Basket.eps.preview-01.jpg'));
    assert.ok(candidates.includes('/tmp/Harvest-Basket.eps.preview_01.jpg'));
  });

  it('builds EPS candidates from the canonical preview path', () => {
    const candidates = getEpsPreviewCandidates('/tmp/Harvest Basket.eps');

    assert.equal(candidates[0], '/tmp/Harvest Basket.eps.preview.jpg');
  });
});
