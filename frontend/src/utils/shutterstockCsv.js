import { createCsv, escapeCsvCell } from './csv.js';
import {
  getAiInfo,
  getPreferredCategories,
  getPreferredDescription,
  getPreferredKeywords,
} from './exportMetadata.js';

export { escapeCsvCell };

export const SHUTTERSTOCK_HEADERS = [
  'Filename',
  'Description',
  'Keywords',
  'Categories',
  'Editorial',
  'Mature content',
  'illustration',
];

export const SHUTTERSTOCK_IMAGE_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vintage',
];

const CATEGORY_LOOKUP = new Map(
  SHUTTERSTOCK_IMAGE_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

function hasSensitiveContent(job) {
  const aiResult = job.results?.find((result) => result.checker_type === 'ai_content');
  return aiResult?.warnings?.some((warning) => warning.code === 'SENSITIVE_CONTENT')
    || aiResult?.errors?.some((error) => error.code === 'SENSITIVE_CONTENT')
    || Boolean(getAiInfo(job).sensitiveDetails);
}

export function createShutterstockRow(job) {
  const categories = [...new Set(
    getPreferredCategories(job)
      .map((category) => CATEGORY_LOOKUP.get(String(category).toLowerCase()))
      .filter(Boolean),
  )].slice(0, 2).join(',');

  return [
    job.original_name,
    getPreferredDescription(job, 200),
    getPreferredKeywords(job, 50).join(','),
    categories,
    'no',
    hasSensitiveContent(job) ? 'yes' : 'no',
    ['eps', 'svg'].includes(job.file_type) ? 'yes' : 'no',
  ];
}

export function createShutterstockCsv(jobs) {
  return createCsv(SHUTTERSTOCK_HEADERS, jobs.map(createShutterstockRow));
}

export function countJobsWithIncompleteMetadata(jobs) {
  return jobs.filter((job) => {
    return !getPreferredDescription(job, 200)
      || getPreferredKeywords(job, 50).length === 0
      || getPreferredCategories(job).length === 0;
  }).length;
}
