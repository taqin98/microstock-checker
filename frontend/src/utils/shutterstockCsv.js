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

function getEpsResult(job) {
  return job.results?.find((result) => result.checker_type === 'eps');
}

function normalizeKeywords(values) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((keyword) => String(keyword).trim())
    .filter((keyword) => {
      const key = keyword.toLowerCase();
      if (!keyword || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

function hasSensitiveContent(aiResult) {
  return aiResult?.warnings?.some((warning) => warning.code === 'SENSITIVE_CONTENT')
    || aiResult?.errors?.some((error) => error.code === 'SENSITIVE_CONTENT')
    || Boolean(aiResult?.info?.sensitiveDetails);
}

export function createShutterstockRow(job) {
  const aiResult = getAiResult(job);
  const aiInfo = aiResult?.info || {};
  const epsInfo = getEpsResult(job)?.info || {};
  const description = String(
    epsInfo.metadataDescription
    || aiInfo.suggestedDescription
    || aiInfo.suggestedTitle
    || '',
  )
    .trim()
    .slice(0, 200);
  const keywords = normalizeKeywords(
    epsInfo.metadataKeywords?.length > 0
      ? epsInfo.metadataKeywords
      : aiInfo.suggestedKeywords,
  ).join(',');
  const selectedCategories = job.metadata_categories?.length > 0
    ? job.metadata_categories
    : aiInfo.suggestedCategories || [];
  const categories = [...new Set(
    selectedCategories
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

export function countJobsWithIncompleteMetadata(jobs) {
  return jobs.filter((job) => {
    const aiResult = getAiResult(job);
    const aiInfo = aiResult?.info;
    const epsInfo = getEpsResult(job)?.info;
    const hasCategories = job.metadata_categories?.length > 0
      || aiInfo?.suggestedCategories?.length > 0;
    const hasDescription = Boolean(
      epsInfo?.metadataDescription
      || aiInfo?.suggestedDescription
      || aiInfo?.suggestedTitle,
    );
    const hasKeywords = epsInfo?.metadataKeywords?.length > 0
      || aiInfo?.suggestedKeywords?.length > 0;

    return !hasDescription
      || !hasKeywords
      || !hasCategories;
  }).length;
}
