/**
 * Gemini client — calls Google's Gemini API (generateContent) over HTTP, like
 * utils/mailer.js does for Resend; no SDK needed.
 *
 * Env:
 *   GEMINI_API_KEY          required; without it the assistant is switched off
 *   GEMINI_MODEL            first model to try (default gemini-3.5-flash-lite: fast
 *                           and rarely overloaded)
 *   GEMINI_FALLBACK_MODELS  comma-separated models tried in order when the one
 *                           before is overloaded, rate-limited or times out.
 *                           A model that failed that way is skipped for a few
 *                           minutes (per server instance).
 *
 * Tests swap the HTTP call out with setTransport(), so they never reach Google.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACKS = 'gemini-flash-lite-latest,gemini-flash-latest';
const COOLDOWN_MS = 3 * 60 * 1000;
const TIMEOUT_MS = 15 * 1000;
// Worth trying the next model: overloaded, rate-limited, or Google's side failed
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

class GeminiError extends Error {
  constructor(message, { status = null, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

// model → time it may be tried again
const coolingDown = new Map();

function modelChain() {
  const list = [process.env.GEMINI_MODEL || DEFAULT_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACKS).split(',')]
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

/** POST one generateContent request to one model. */
async function httpTransport({ model, body, timeoutMs }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new GeminiError(timedOut ? `${model} timed out` : `${model} unreachable: ${err.message}`, { retryable: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GeminiError(`${model} ${res.status}: ${data?.error?.message || res.statusText}`, {
      status: res.status,
      retryable: RETRYABLE.has(res.status) || res.status === 404, // 404: model retired for this key
    });
  }
  return data;
}

let transport = httpTransport;
/** Tests only: replace the HTTP call. Pass nothing to restore it. */
function setTransport(fn) {
  transport = fn || httpTransport;
  coolingDown.clear();
}

/**
 * One generateContent call, falling back down the model chain.
 *
 * @param {object}   req
 * @param {string}   req.systemInstruction
 * @param {object[]} req.contents          Gemini contents ([{ role, parts }])
 * @param {object[]} [req.tools]           function declarations
 * @param {'AUTO'|'NONE'} [req.toolMode]
 * @param {object}   [req.responseSchema]  JSON schema → structured JSON output
 * @param {number}   [req.temperature]
 * @returns {Promise<{ content: object, parts: object[], text: string, functionCalls: object[], finishReason: string, model: string }>}
 */
async function generate({ systemInstruction, contents, tools, toolMode = 'AUTO', responseSchema, temperature = 0.4, timeoutMs = TIMEOUT_MS }) {
  if (!isConfigured()) throw new GeminiError('GEMINI_API_KEY is not set', { status: 503 });

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: { temperature, maxOutputTokens: 2048 },
  };
  if (tools?.length) {
    body.tools = [{ functionDeclarations: tools }];
    body.toolConfig = { functionCallingConfig: { mode: toolMode } };
  }
  if (responseSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseJsonSchema = responseSchema;
  }

  // Skip models that just failed, unless that leaves none
  const chain = modelChain();
  const ready = chain.filter((m) => !(coolingDown.get(m) > Date.now()));

  let lastError;
  for (const model of ready.length ? ready : chain) {
    try {
      const data = await transport({ model, body, timeoutMs });
      const candidate = data?.candidates?.[0];
      if (!candidate?.content) {
        const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || 'EMPTY';
        throw new GeminiError(`${model} returned no content (${reason})`, { retryable: reason === 'EMPTY' });
      }
      const parts = candidate.content.parts || [];
      return {
        content: { role: 'model', parts },
        parts,
        // Thought summaries are not part of the answer
        text: parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim(),
        functionCalls: parts.filter((p) => p.functionCall).map((p) => p.functionCall),
        finishReason: candidate.finishReason,
        model,
      };
    } catch (err) {
      lastError = err instanceof GeminiError ? err : new GeminiError(err.message);
      console.error('[Gemini]', lastError.message);
      if (!lastError.retryable) break;
      coolingDown.set(model, Date.now() + COOLDOWN_MS);
    }
  }
  throw lastError;
}

module.exports = { GeminiError, isConfigured, modelChain, generate, setTransport };
