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

export function escapeCsvCell(value) {
  const text = String(value ?? '');

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function getAiResult(job) {
  return job.results?.find((result) => result.checker_type === 'ai_content');
}

function hasSensitiveContent(aiResult) {
  return aiResult?.warnings?.some((warning) => warning.code === 'SENSITIVE_CONTENT')
    || aiResult?.errors?.some((error) => error.code === 'SENSITIVE_CONTENT')
    || Boolean(aiResult?.info?.sensitiveDetails);
}

export function createShutterstockRow(job) {
  const aiResult = getAiResult(job);
  const info = aiResult?.info || {};
  const description = String(info.suggestedDescription || info.suggestedTitle || '')
    .trim()
    .slice(0, 200);
  const keywords = [...new Set(
    (info.suggestedKeywords || [])
      .map((keyword) => String(keyword).trim())
      .filter(Boolean),
  )].slice(0, 50).join(',');
  const categories = [...new Set(
    (info.suggestedCategories || [])
      .map((category) => CATEGORY_LOOKUP.get(String(category).toLowerCase()))
      .filter(Boolean),
  )].slice(0, 2).join(',');

  return [
    job.original_name,
    description,
    keywords,
    categories,
    'no',
    hasSensitiveContent(aiResult) ? 'yes' : 'no',
    ['eps', 'svg'].includes(job.file_type) ? 'yes' : 'no',
  ];
}

export function createShutterstockCsv(jobs) {
  const rows = jobs.map(createShutterstockRow);

  return [SHUTTERSTOCK_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

export function countJobsWithoutAiMetadata(jobs) {
  return jobs.filter((job) => {
    const aiResult = getAiResult(job);
    const info = aiResult?.info;
    return !(info?.suggestedDescription || info?.suggestedTitle)
      || !info?.suggestedKeywords?.length
      || !info?.suggestedCategories?.length;
  }).length;
}
