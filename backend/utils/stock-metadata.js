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

export function validateSelectedCategories(values, rules = {}) {
  const metadataRules = rules.metadata || {};
  const allowedCategories = metadataRules.imageCategories || [];
  const maxCategories = metadataRules.categoryMaxCount || 2;

  if (!Array.isArray(values)) {
    return { valid: false, error: 'Categories must be an array' };
  }

  if (values.length < 1 || values.length > maxCategories) {
    return {
      valid: false,
      error: `Select between 1 and ${maxCategories} categories`,
    };
  }

  const canonicalCategories = new Map(
    allowedCategories.map((category) => [category.toLowerCase(), category]),
  );
  const categories = values.map((value) =>
    canonicalCategories.get(String(value || '').trim().toLowerCase()),
  );

  if (categories.some((category) => !category)) {
    return { valid: false, error: 'One or more categories are not supported' };
  }

  if (new Set(categories).size !== categories.length) {
    return { valid: false, error: 'Category 1 and Category 2 must be different' };
  }

  return { valid: true, categories };
}
