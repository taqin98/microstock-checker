import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getAiCache, setAiCache, getAiUsageToday, incrementAiUsage } from '../db/database.js';
import { classifyAiApiError } from '../utils/ai-api-error.js';
import { createLogger } from '../utils/logger.js';
import { normalizeStockMetadata } from '../utils/stock-metadata.js';

dotenv.config();

const log = createLogger('ai-content');

const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '500', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const AI_CACHE_VERSION = 'metadata-v2';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    trademarkDetected: { type: 'boolean' },
    intellectualPropertyConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    trademarkDetails: { type: 'string', nullable: true },
    sensitiveContent: { type: 'boolean' },
    sensitiveDetails: { type: 'string', nullable: true },
    isAiGenerated: { type: 'boolean' },
    aiGeneratedConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    aiGeneratedDetails: { type: 'string', nullable: true },
    similarContentRisk: { type: 'boolean' },
    similarContentDetails: { type: 'string', nullable: true },
    poorQuality: { type: 'boolean' },
    qualityDetails: { type: 'string', nullable: true },
    suggestedTitle: { type: 'string' },
    suggestedDescription: { type: 'string' },
    suggestedKeywords: { type: 'array', items: { type: 'string' } },
    suggestedCategories: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['trademarkDetected', 'intellectualPropertyConfidence', 'sensitiveContent', 'isAiGenerated', 'aiGeneratedConfidence', 'similarContentRisk', 'poorQuality', 'suggestedTitle', 'suggestedDescription', 'suggestedKeywords', 'suggestedCategories', 'confidence'],
};

function buildPrompt(rules = {}) {
  const maxKeywords = rules.aiContent?.maxKeywords || 50;
  const metadataRules = rules.metadata || {};
  const maxTitleLength = metadataRules.titleMaxLength || 200;
  const maxDescriptionLength = metadataRules.descriptionMaxLength || 200;
  const categories = metadataRules.imageCategories || [];
  const maxCategories = metadataRules.categoryMaxCount || 2;
  const categoryInstruction = categories.length > 0
    ? `Choose ${maxCategories === 1 ? 'exactly one category' : `one or two categories, with at most ${maxCategories}`} from this exact list only: ${categories.join(', ')}.`
    : 'Return an empty array because this platform has no configured category list.';
  const aiPolicy = rules.aiContent?.prohibitAiGenerated
    ? 'This platform prohibits AI-generated content. Detect it carefully and report concrete visual evidence.'
    : 'This platform may accept AI-generated content, but it must still be identified accurately.';

  return `You are a strict, expert Quality Assurance Reviewer for top-tier microstock platforms (Shutterstock, Adobe Stock, Getty Images).

Analyze this image and return ONLY a JSON object with the following structure:

{
  "trademarkDetected": boolean — true if ANY potentially protected intellectual property is visible, including artwork, writing, readable copyrighted text, sheet music, logos, trademarks, branded products, copyrighted characters, distinctive product designs, isolated modern architecture, or other copyright-protected objects,
  "intellectualPropertyConfidence": "low" | "medium" | "high" — confidence specifically for the intellectual-property classification,
  "trademarkDetails": string or null — identify the visible subject and explain why it may be protected intellectual property,
  "sensitiveContent": boolean — true if violence, adult/NSFW content, controversial symbols, or offensive material is present,
  "sensitiveDetails": string or null — describe what was detected,
  "isAiGenerated": boolean — true when visual evidence indicates the content was generated wholly or partly with generative AI. Inspect anatomy, text, repeated shapes, inconsistent geometry, impossible details, synthetic textures, vector path regularity, and composition patterns,
  "aiGeneratedConfidence": "low" | "medium" | "high" — confidence specifically for the AI-origin classification,
  "aiGeneratedDetails": string or null — describe concrete evidence for the AI-origin classification,
  "similarContentRisk": boolean — true if this is an extremely generic, low-effort composition that floods stock sites (e.g. basic 3D cubes, plain white backgrounds with basic shapes, generic AI spam),
  "similarContentDetails": string or null — explain why it's considered generic or spam-like,
  "poorQuality": boolean — true if the image has bad lighting, blurry focus, poor composition, or overall amateur execution,
  "qualityDetails": string or null — explain the quality issues,
  "suggestedTitle": string — a concise, highly descriptive, commercial title suitable for microstock listing (in English), no longer than ${maxTitleLength} characters,
  "suggestedDescription": string — a unique, detailed English description no longer than ${maxDescriptionLength} characters,
  "suggestedKeywords": array of strings — up to ${maxKeywords} highly relevant keywords for microstock search (in English, lowercase),
  "suggestedCategories": array of strings — ${categoryInstruction},
  "confidence": "low" | "medium" | "high" — your confidence level in the analysis
}

CRITICAL RULES:
1. Be extremely thorough and conservative. If in doubt about a trademark/IP, flag it to be safe.
2. ${aiPolicy}
3. Do not classify content as AI-generated solely because it is an illustration or vector. Require visual evidence and use low confidence when evidence is ambiguous.
4. For AI-generated detection, inspect hands, faces, text, repeated motifs, background details, edges, symmetry, perspective, and structural logic.
5. Do NOT include brand names in suggestedKeywords.
6. ${categoryInstruction}`;
}

function meetsConfidenceThreshold(confidence, threshold = 'medium') {
  const levels = { low: 1, medium: 2, high: 3 };
  return (levels[confidence] || 0) >= (levels[threshold] || levels.medium);
}

function hashFile(filePath, rules) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256')
    .update(AI_CACHE_VERSION)
    .update(rules.platform || 'unknown-platform')
    .update(JSON.stringify(rules.metadata || {}))
    .update(content)
    .digest('hex');
}

export async function checkAiContent(filePath, rules = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const info = {};

  log.info(`AI content check: ${filePath}`);

  // Check daily limit
  const usageToday = getAiUsageToday();
  if (usageToday >= AI_DAILY_LIMIT) {
    log.warn('Daily AI limit reached', { usage: usageToday, limit: AI_DAILY_LIMIT });
    return {
      valid: true,
      errors: [],
      warnings: [{ code: 'AI_LIMIT_REACHED', message: `Daily AI check limit reached (${usageToday}/${AI_DAILY_LIMIT}). Skipped.` }],
      info: { skipped: true, reason: 'daily_limit' },
    };
  }

  // Check cache
  const fileHash = hashFile(filePath, rules);
  const cached = options.forceRefresh ? null : getAiCache(fileHash);
  if (cached) {
    log.info('Using cached AI result', { hash: fileHash.slice(0, 12) });
    return mapAiResultToCheckerOutput(cached.result, rules, { fromCache: true });
  }

  // Verify API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return {
      valid: true,
      errors: [],
      warnings: [{ code: 'AI_NOT_CONFIGURED', message: 'Gemini API key not configured. AI check skipped.' }],
      info: { skipped: true, reason: 'no_api_key' },
    };
  }

  // Call Gemini API with retry
  let aiResult = null;
  let apiLimitFailure = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt(rules) },
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text
        || response.text?.()
        || response.text;

      // Clean up potential markdown code blocks
      const cleanText = (typeof text === 'function' ? text() : text)
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      aiResult = JSON.parse(cleanText);
      incrementAiUsage();

      // Cache the result
      setAiCache({ fileHash, result: aiResult, provider: 'gemini', model: GEMINI_MODEL });

      break;
    } catch (err) {
      apiLimitFailure = classifyAiApiError(err);

      if (apiLimitFailure) {
        log.warn('Gemini API limit reached', {
          type: apiLimitFailure.type,
          retryAfterSeconds: apiLimitFailure.retryAfterSeconds,
          quotaLimit: apiLimitFailure.quotaLimit,
          model: apiLimitFailure.model,
        });
        break;
      }

      log.error(`AI API attempt ${attempt} failed`, { error: err.message });

      if (attempt < maxAttempts) {
        const backoffMs = attempt * 3000;
        log.info(`Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  if (!aiResult) {
    if (apiLimitFailure?.type === 'daily_quota') {
      const limitText = apiLimitFailure.quotaLimit
        ? ` Batas paket saat ini adalah ${apiLimitFailure.quotaLimit} permintaan per hari.`
        : '';

      return {
        valid: true,
        errors: [],
        warnings: [{
          code: 'AI_DAILY_QUOTA_EXHAUSTED',
          message: `Kuota harian Gemini telah habis.${limitText} Analisis AI dilewati, tetapi hasil pemeriksaan teknis tetap valid.`,
        }],
        info: {
          skipped: true,
          reason: 'provider_daily_quota',
          retryAfterSeconds: apiLimitFailure.retryAfterSeconds,
          quotaLimit: apiLimitFailure.quotaLimit,
          model: apiLimitFailure.model,
        },
      };
    }

    if (apiLimitFailure?.type === 'rate_limit') {
      const retryText = apiLimitFailure.retryAfterSeconds
        ? ` Coba lagi dalam sekitar ${apiLimitFailure.retryAfterSeconds} detik.`
        : ' Tunggu sebentar, lalu coba lagi.';

      return {
        valid: true,
        errors: [],
        warnings: [{
          code: 'AI_RATE_LIMITED',
          message: `Batas permintaan Gemini sedang tercapai.${retryText} Analisis AI dilewati, tetapi hasil pemeriksaan teknis tetap valid.`,
        }],
        info: {
          skipped: true,
          reason: 'provider_rate_limit',
          retryAfterSeconds: apiLimitFailure.retryAfterSeconds,
          quotaLimit: apiLimitFailure.quotaLimit,
          model: apiLimitFailure.model,
        },
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: [{ code: 'AI_CHECK_FAILED', message: 'AI content check failed after retries. Technical checks still valid.' }],
      info: { skipped: true, reason: 'api_error' },
    };
  }

  return mapAiResultToCheckerOutput(aiResult, rules, { fromCache: false });
}

function mapAiResultToCheckerOutput(aiResult, rules = {}, meta = {}) {
  const errors = [];
  const warnings = [];
  const intellectualPropertyConfidence = aiResult.intellectualPropertyConfidence || aiResult.confidence || 'low';
  const aiGeneratedConfidence = aiResult.aiGeneratedConfidence || aiResult.confidence || 'low';
  const metadata = normalizeStockMetadata(aiResult, rules);
  const info = {
    suggestedTitle: metadata.title,
    suggestedDescription: metadata.description,
    suggestedKeywords: metadata.keywords,
    suggestedCategories: metadata.categories,
    confidence: aiResult.confidence,
    fromCache: meta.fromCache || false,
    intellectualPropertyDetected: Boolean(aiResult.trademarkDetected),
    intellectualPropertyConfidence,
    isAiGenerated: Boolean(aiResult.isAiGenerated),
    aiGeneratedConfidence,
  };

  if (aiResult.trademarkDetected) {
    const details = aiResult.trademarkDetails || 'Potentially protected subject matter detected';
    const shouldReject = rules.aiContent?.prohibitIntellectualProperty
      && meetsConfidenceThreshold(intellectualPropertyConfidence, rules.aiContent?.flagThreshold);

    if (shouldReject) {
      errors.push({
        code: 'INTELLECTUAL_PROPERTY_INFRINGEMENT_RISK',
        message: `Intellectual Property: Content contains subject matter that potentially infringes on intellectual property rights (e.g. artwork, writing, sheet music, isolated modern architecture, or other objects protected by copyright). Evidence: ${details}`,
      });
    } else {
      warnings.push({
        code: 'INTELLECTUAL_PROPERTY_REVIEW',
        message: `Possible intellectual property risk (${intellectualPropertyConfidence} confidence): ${details}`,
      });
    }
    info.trademarkDetails = aiResult.trademarkDetails;
  }

  if (aiResult.sensitiveContent) {
    warnings.push({
      code: 'SENSITIVE_CONTENT',
      message: `Sensitive content flagged: ${aiResult.sensitiveDetails || 'Review manually'}`,
    });
    info.sensitiveDetails = aiResult.sensitiveDetails;
  }

  if (aiResult.isAiGenerated) {
    const details = aiResult.aiGeneratedDetails || 'Visual evidence indicates generative AI content';
    const shouldReject = rules.aiContent?.prohibitAiGenerated
      && meetsConfidenceThreshold(aiGeneratedConfidence, rules.aiContent?.flagThreshold);

    if (shouldReject) {
      errors.push({
        code: 'AI_GENERATED_CONTENT_PROHIBITED',
        message: `AI Generated Content: AI generated content is prohibited. Repeated submission of such content will result in account suspension and/or termination. Evidence: ${details}`,
      });
    } else {
      warnings.push({
        code: 'AI_GENERATED_CONTENT_REVIEW',
        message: `Possible AI-generated content (${aiGeneratedConfidence} confidence): ${details}`,
      });
    }
    info.aiGeneratedDetails = aiResult.aiGeneratedDetails;
  }

  if (aiResult.similarContentRisk) {
    warnings.push({
      code: 'SIMILAR_CONTENT_SPAM',
      message: `Similar content/Spam risk: ${aiResult.similarContentDetails || 'Image is too generic'}`,
    });
    info.similarContentDetails = aiResult.similarContentDetails;
  }

  if (aiResult.poorQuality) {
    warnings.push({
      code: 'POOR_COMMERCIAL_QUALITY',
      message: `Quality issues: ${aiResult.qualityDetails || 'Does not meet commercial standards'}`,
    });
    info.qualityDetails = aiResult.qualityDetails;
  }

  return { valid: errors.length === 0, errors, warnings, info };
}
