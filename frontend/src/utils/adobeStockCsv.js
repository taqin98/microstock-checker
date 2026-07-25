import { createCsv } from './csv.js';
import {
  getPreferredCategories,
  getPreferredKeywords,
  getPreferredTitle,
} from './exportMetadata.js';

export const ADOBE_STOCK_HEADERS = [
  'Filename',
  'Title',
  'Keywords',
  'Category',
  'Releases',
];

export const ADOBE_STOCK_CATEGORIES = [
  { code: 1, name: 'Animals' },
  { code: 2, name: 'Buildings and Architecture' },
  { code: 3, name: 'Business' },
  { code: 4, name: 'Drinks' },
  { code: 5, name: 'The Environment' },
  { code: 6, name: 'States of Mind' },
  { code: 7, name: 'Food' },
  { code: 8, name: 'Graphic Resources' },
  { code: 9, name: 'Hobbies and Leisure' },
  { code: 10, name: 'Industry' },
  { code: 11, name: 'Landscapes' },
  { code: 12, name: 'Lifestyle' },
  { code: 13, name: 'People' },
  { code: 14, name: 'Plants and Flowers' },
  { code: 15, name: 'Culture and Religion' },
  { code: 16, name: 'Science' },
  { code: 17, name: 'Social Issues' },
  { code: 18, name: 'Sports' },
  { code: 19, name: 'Technology' },
  { code: 20, name: 'Transport' },
  { code: 21, name: 'Travel' },
];

const CATEGORY_CODES = new Map(
  ADOBE_STOCK_CATEGORIES.map(({ code, name }) => [name.toLowerCase(), code]),
);

function getCategoryCode(job) {
  const category = getPreferredCategories(job)[0];
  return CATEGORY_CODES.get(String(category || '').toLowerCase()) || '';
}

export function createAdobeStockRow(job) {
  return [
    job.original_name,
    getPreferredTitle(job, 200),
    getPreferredKeywords(job, 49).join(', '),
    getCategoryCode(job),
    '',
  ];
}

export function createAdobeStockCsv(jobs) {
  return createCsv(ADOBE_STOCK_HEADERS, jobs.map(createAdobeStockRow));
}

export function countAdobeStockJobsWithIncompleteMetadata(jobs) {
  return jobs.filter((job) =>
    !getPreferredTitle(job, 200)
    || getPreferredKeywords(job, 49).length === 0
    || !getCategoryCode(job)
  ).length;
}
