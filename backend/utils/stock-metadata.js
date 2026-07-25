function normalizeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeList(values, maxItems) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  const normalized = [];

  for (const value of values) {
    const item = String(value || '').trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;

    seen.add(key);
    normalized.push(item);
    if (normalized.length === maxItems) break;
  }

  return normalized;
}

function normalizeCategories(values, allowedCategories, maxItems) {
  if (!Array.isArray(allowedCategories) || allowedCategories.length === 0) return [];

  const canonicalCategories = new Map(
    allowedCategories.map((category) => [category.toLowerCase(), category]),
  );

  return normalizeList(values, allowedCategories.length)
    .map((category) => canonicalCategories.get(category.toLowerCase()))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeStockMetadata(aiResult, rules = {}) {
  const metadataRules = rules.metadata || {};
  const aiRules = rules.aiContent || {};

  return {
    title: normalizeText(aiResult.suggestedTitle, metadataRules.titleMaxLength || 200),
    description: normalizeText(
      aiResult.suggestedDescription || aiResult.suggestedTitle,
      metadataRules.descriptionMaxLength || 200,
    ),
    keywords: normalizeList(
      aiResult.suggestedKeywords,
      metadataRules.keywordMaxCount || aiRules.maxKeywords || 50,
    ),
    categories: normalizeCategories(
      aiResult.suggestedCategories,
      metadataRules.imageCategories,
      metadataRules.categoryMaxCount || 2,
    ),
  };
}
