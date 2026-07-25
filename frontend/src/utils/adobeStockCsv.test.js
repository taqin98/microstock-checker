import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdobeStockCsv,
  createAdobeStockRow,
} from './adobeStockCsv.js';

const job = {
  original_name: 'autumn, basket.eps',
  file_type: 'eps',
  platform: 'adobestock',
  metadata_categories: ['Graphic Resources'],
  results: [
    {
      checker_type: 'eps',
      info: {
        metadataTitle: 'Harvest Pumpkin Basket Border',
        metadataKeywords: ['pumpkin', 'harvest', 'basket'],
      },
    },
    {
      checker_type: 'ai_content',
      info: {
        suggestedTitle: 'AI fallback title',
        suggestedKeywords: ['ai', 'fallback'],
        suggestedCategories: ['Plants and Flowers'],
      },
    },
  ],
};

describe('Adobe Stock CSV export', () => {
  it('maps metadata to the Adobe Stock columns and numeric category', () => {
    assert.deepEqual(createAdobeStockRow(job), [
      'autumn, basket.eps',
      'Harvest Pumpkin Basket Border',
      'pumpkin, harvest, basket',
      8,
      '',
    ]);
  });

  it('matches the provided Adobe Stock header order', () => {
    const [header, row] = createAdobeStockCsv([job]).split('\r\n');

    assert.equal(header, 'Filename,Title,Keywords,Category,Releases');
    assert.equal(
      row,
      '"autumn, basket.eps",Harvest Pumpkin Basket Border,"pumpkin, harvest, basket",8,',
    );
  });

  it('limits title to 200 characters and keywords to 49', () => {
    const limitedJob = {
      ...job,
      results: [
        {
          checker_type: 'ai_content',
          info: {
            suggestedTitle: 'a'.repeat(220),
            suggestedKeywords: Array.from({ length: 55 }, (_, index) => `keyword-${index}`),
            suggestedCategories: ['Technology'],
          },
        },
      ],
      metadata_categories: [],
    };
    const row = createAdobeStockRow(limitedJob);

    assert.equal(row[1].length, 200);
    assert.equal(row[2].split(', ').length, 49);
    assert.equal(row[3], 19);
  });

  it('falls back to AI when embedded EPS metadata is unavailable', () => {
    const fallbackJob = {
      ...job,
      results: job.results.filter((result) => result.checker_type === 'ai_content'),
      metadata_categories: [],
    };
    const row = createAdobeStockRow(fallbackJob);

    assert.equal(row[1], 'AI fallback title');
    assert.equal(row[2], 'ai, fallback');
    assert.equal(row[3], 14);
  });
});
