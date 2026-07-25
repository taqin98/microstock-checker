export function getAiInfo(job) {
  return job.results?.find((result) => result.checker_type === 'ai_content')?.info || {};
}

export function getEpsInfo(job) {
  return job.results?.find((result) => result.checker_type === 'eps')?.info || {};
}

export function normalizeKeywords(values, maxKeywords) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((keyword) => String(keyword).trim())
    .filter((keyword) => {
      const key = keyword.toLowerCase();
      if (!keyword || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxKeywords);
}

export function getPreferredTitle(job, maxLength = 200) {
  const aiInfo = getAiInfo(job);
  const epsInfo = getEpsInfo(job);

  return String(
    epsInfo.metadataTitle
    || aiInfo.suggestedTitle
    || aiInfo.suggestedDescription
    || '',
  ).trim().slice(0, maxLength);
}

export function getPreferredDescription(job, maxLength = 200) {
  const aiInfo = getAiInfo(job);
  const epsInfo = getEpsInfo(job);

  return String(
    epsInfo.metadataDescription
    || aiInfo.suggestedDescription
    || aiInfo.suggestedTitle
    || '',
  ).trim().slice(0, maxLength);
}

export function getPreferredKeywords(job, maxKeywords) {
  const aiInfo = getAiInfo(job);
  const epsInfo = getEpsInfo(job);

  return normalizeKeywords(
    epsInfo.metadataKeywords?.length > 0
      ? epsInfo.metadataKeywords
      : aiInfo.suggestedKeywords,
    maxKeywords,
  );
}

export function getPreferredCategories(job) {
  const aiInfo = getAiInfo(job);

  return job.metadata_categories?.length > 0
    ? job.metadata_categories
    : aiInfo.suggestedCategories || [];
}
