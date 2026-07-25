import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createShutterstockCsv,
  createShutterstockRow,
  escapeCsvCell,
} from './shutterstockCsv.js';

const job = {
  original_name: 'Harvest, Basket.eps',
  file_type: 'eps',
  results: [
    {
      checker_type: 'ai_content',
      errors: [],
      warnings: [{ code: 'SENSITIVE_CONTENT' }],
      info: {
        suggestedTitle: 'Autumn "Harvest" Basket',
        suggestedDescription: 'Detailed autumn basket with "pumpkins"',
        suggestedKeywords: ['autumn', 'pumpkin'],
        suggestedCategories: ['nature', 'Objects', 'Invalid'],
      },
    },
  ],
};

describe('Shutterstock CSV export', () => {
  it('maps AI metadata to the Shutterstock columns', () => {
    assert.deepEqual(createShutterstockRow(job), [
      'Harvest, Basket.eps',
      'Detailed autumn basket with "pumpkins"',
      'autumn,pumpkin',
      'Nature,Objects',
      'no',
      'yes',
      'yes',
    ]);
  });

  it('escapes commas, quotes, and line breaks', () => {
    assert.equal(escapeCsvCell('Harvest, Basket'), '"Harvest, Basket"');
    assert.equal(escapeCsvCell('Autumn "Harvest"'), '"Autumn ""Harvest"""');
    assert.equal(escapeCsvCell('line 1\nline 2'), '"line 1\nline 2"');
  });

  it('creates a CSV matching the provided Shutterstock header order', () => {
    const csv = createShutterstockCsv([job]);
    const [header, row] = csv.split('\r\n');

    assert.equal(
      header,
      'Filename,Description,Keywords,Categories,Editorial,Mature content,illustration',
    );
    assert.equal(
      row,
      '"Harvest, Basket.eps","Detailed autumn basket with ""pumpkins""","autumn,pumpkin","Nature,Objects",no,yes,yes',
    );
  });

  it('limits metadata to Shutterstock requirements', () => {
    const longMetadataJob = {
      ...job,
      results: [{
        ...job.results[0],
        info: {
          suggestedDescription: 'a'.repeat(220),
          suggestedKeywords: Array.from({ length: 55 }, (_, index) => `keyword-${index}`),
          suggestedCategories: ['Nature', 'Objects', 'Arts'],
        },
      }],
    };

    const row = createShutterstockRow(longMetadataJob);

    assert.equal(row[1].length, 200);
    assert.equal(row[2].split(',').length, 50);
    assert.equal(row[3], 'Nature,Objects');
  });

  it('prefers manually saved categories over AI suggestions', () => {
    const row = createShutterstockRow({
      ...job,
      metadata_categories: ['Arts', 'Holidays'],
    });

    assert.equal(row[3], 'Arts,Holidays');
  });
});
