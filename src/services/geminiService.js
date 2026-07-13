import { env } from '../config/env.js';

export const IMPORT_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const PARSE_PROMPT = `You extract real estate leads from unstructured content.
Return ONLY a valid JSON array. No markdown, no explanation, no code fences.

Each object must have exactly these keys:
- name (string or null)
- phone (string or null)
- email (string or null)
- note (string or null)
- source (one of: facebook_ad, tiktok_ad, referral, bulk_import, manual — infer from context)
- sourceDetail (string or null — e.g. "Facebook Ad - Hayatabad March 2026")
- propertyInterest (string or null — property name, address, or area they inquired about)
- propertyType (one of: house, apartment, plot, commercial, or null)
- type (one of: buyer, renter — default buyer)

Rules:
- Extract every distinct lead you can find
- Normalize phone numbers as digits with optional leading +
- If a field is missing, use null
- Do not invent leads that are not in the source

Example output:
[{"name":"John Doe","phone":"+923001234567","email":"john@example.com","note":"Budget 80 lakh","source":"facebook_ad","sourceDetail":"FB Ad Hayatabad","propertyInterest":"Phase 6 Hayatabad House","propertyType":"house","type":"buyer"}]`;

function extractJsonArray(text) {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const parsed = JSON.parse(arrayMatch[0]);
    if (Array.isArray(parsed)) return parsed;
  }

  throw new Error('Could not parse leads from AI response');
}

function normalizeParsedLead(raw) {
  const validSources = ['facebook_ad', 'tiktok_ad', 'referral', 'bulk_import', 'manual'];
  const validTypes = ['house', 'apartment', 'plot', 'commercial'];
  return {
    name: raw.name?.trim() || null,
    phone: raw.phone?.trim() || null,
    email: raw.email?.trim()?.toLowerCase() || null,
    note: raw.note?.trim() || null,
    source: validSources.includes(raw.source) ? raw.source : 'bulk_import',
    sourceDetail: raw.sourceDetail?.trim() || null,
    propertyInterest: raw.propertyInterest?.trim() || null,
    propertyType: validTypes.includes(raw.propertyType) ? raw.propertyType : null,
    type: raw.type?.trim() || 'buyer',
  };
}

function assertGeminiConfigured() {
  if (!env.geminiApiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
}

async function callGeminiParse(parts) {
  assertGeminiConfigured();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error?.message || 'Gemini API request failed';
    const err = new Error(
      msg.includes('quota') || msg.includes('Quota')
        ? 'AI parser is temporarily unavailable (API quota). Try again later or add credits to your Gemini API key.'
        : msg
    );
    err.status = res.status === 429 || msg.includes('quota') ? 503 : res.status === 400 ? 400 : 502;
    throw err;
  }

  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    const err = new Error('Empty response from AI parser');
    err.status = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = extractJsonArray(responseText);
  } catch {
    const err = new Error('AI returned malformed data — try a clearer source and parse again');
    err.status = 422;
    throw err;
  }

  return parsed
    .map(normalizeParsedLead)
    .filter((l) => l.name || l.phone);
}

export async function parseLeadsFromText(text) {
  if (!text?.trim()) {
    const err = new Error('Text is required');
    err.status = 400;
    throw err;
  }

  return callGeminiParse([
    { text: `${PARSE_PROMPT}\n\nExtract leads from this text:\n${text}` },
  ]);
}

export async function parseLeadsFromFile(buffer, mimeType) {
  if (!buffer?.length) {
    const err = new Error('File is required');
    err.status = 400;
    throw err;
  }

  if (!IMPORT_FILE_TYPES.includes(mimeType)) {
    const err = new Error('Unsupported file type. Use PDF, JPG, PNG, or WebP.');
    err.status = 400;
    throw err;
  }

  return callGeminiParse([
    { text: `${PARSE_PROMPT}\n\nExtract leads from the attached document or image.` },
    { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
  ]);
}
