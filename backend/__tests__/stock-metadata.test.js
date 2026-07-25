import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStockMetadata } from '../utils/stock-metadata.js';

const rules = {
  metadata: {
    descriptionMaxLength: 20,
    keywordMaxCount: 3,
    categoryMaxCount: 2,
    imageCategories: ['Nature', 'Objects', 'Parks/Outdoor'],
  },
};

describe('Stock metadata normalization', () => {
  it('enforces description, keyword, and category limits', () => {
    const metadata = normalizeStockMetadata({
      suggestedTitle: 'Autumn basket',
      suggestedDescription: 'A detailed autumn basket illustration',
      suggestedKeywords: ['autumn', 'basket', 'Autumn', 'pumpkin'],
      suggestedCategories: ['nature', 'Objects', 'Invalid'],
    }, rules);

    assert.equal(metadata.description, 'A detailed autumn ba');
    assert.deepEqual(metadata.keywords, ['autumn', 'basket', 'pumpkin']);
    assert.deepEqual(metadata.categories, ['Nature', 'Objects']);
  });

  it('uses the title when a legacy AI result has no description', () => {
    const metadata = normalizeStockMetadata({
      suggestedTitle: 'Autumn basket',
      suggestedKeywords: [],
    }, rules);

    assert.equal(metadata.description, 'Autumn basket');
    assert.deepEqual(metadata.categories, []);
  });
});
