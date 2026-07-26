function parseErrorPayload(error) {
  if (error?.response?.data && typeof error.response.data === 'object') {
    return error.response.data;
  }

  if (typeof error?.message !== 'string') {
    return null;
  }

  try {
    return JSON.parse(error.message);
  } catch {
    return null;
  }
}

function parseRetryDelay(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.ceil(Number(match[1])) : null;
}

export function classifyAiApiError(error) {
  const payload = parseErrorPayload(error);
  const providerError = payload?.error || payload;
  const statusCode = Number(providerError?.code || error?.status || error?.statusCode);
  const status = providerError?.status || error?.status;
  const message = providerError?.message || error?.message || '';

  if (statusCode !== 429 && status !== 'RESOURCE_EXHAUSTED') {
    return null;
  }

  const details = Array.isArray(providerError?.details) ? providerError.details : [];
  const quotaFailure = details.find((detail) => detail?.['@type']?.endsWith('QuotaFailure'));
  const retryInfo = details.find((detail) => detail?.['@type']?.endsWith('RetryInfo'));
  const violation = quotaFailure?.violations?.[0];
  const quotaId = violation?.quotaId || '';
  const isDailyQuota = /per.?day/i.test(quotaId) || /\b(per day|daily quota)\b/i.test(message);

  return {
    type: isDailyQuota ? 'daily_quota' : 'rate_limit',
    retryAfterSeconds: parseRetryDelay(retryInfo?.retryDelay),
    quotaLimit: violation?.quotaValue ? Number(violation.quotaValue) : null,
    model: violation?.quotaDimensions?.model || null,
  };
}
