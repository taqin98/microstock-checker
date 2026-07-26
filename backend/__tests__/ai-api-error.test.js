import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAiApiError } from '../utils/ai-api-error.js';

test('classifies Gemini per-day quota exhaustion', () => {
  const error = new Error(JSON.stringify({
    error: {
      code: 429,
      message: 'You exceeded your current quota. Quota exceeded for requests per day.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{
            quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
            quotaValue: '20',
            quotaDimensions: { model: 'gemini-3.5-flash' },
          }],
        },
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '38s',
        },
      ],
    },
  }));

  assert.deepEqual(classifyAiApiError(error), {
    type: 'daily_quota',
    retryAfterSeconds: 38,
    quotaLimit: 20,
    model: 'gemini-3.5-flash',
  });
});

test('classifies a temporary 429 as rate limiting', () => {
  const error = new Error(JSON.stringify({
    error: {
      code: 429,
      message: 'Too many requests.',
      status: 'RESOURCE_EXHAUSTED',
      details: [{
        '@type': 'type.googleapis.com/google.rpc.RetryInfo',
        retryDelay: '4.2s',
      }],
    },
  }));

  assert.deepEqual(classifyAiApiError(error), {
    type: 'rate_limit',
    retryAfterSeconds: 5,
    quotaLimit: null,
    model: null,
  });
});

test('ignores non-limit API errors', () => {
  assert.equal(classifyAiApiError(new Error('Internal server error')), null);
});
