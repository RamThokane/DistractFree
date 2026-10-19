/**
 * Gemini client — calls Google's Gemini API (generateContent) over HTTP, like
 * utils/mailer.js does for Resend; no SDK needed.
 *
 * Gemini models often hang for a while when Google is short of capacity, and
 * which ones hang changes from minute to minute. So a call is hedged: it asks
 * the first model, and if no answer has come after HEDGE_MS it also asks the
 * next one (immediately, if the first one failed). The first good answer wins;
 * the other requests are cancelled. Models that failed or were too slow are
 * tried last for a few minutes (per server instance).
 *
 * Env:
 *   GEMINI_API_KEY          required; without it the assistant is switched off
 *   GEMINI_MODEL            first model to ask (default gemini-3.5-flash-lite)
 *   GEMINI_FALLBACK_MODELS  comma-separated models asked next, in order
 *   GEMINI_HEDGE_MS         how long to wait before also asking the next model (default 4000)
 *
 * Tests swap the HTTP call out with setTransport(), so they never reach Google.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACKS = 'gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.6-flash,gemini-flash-lite-latest,gemini-flash-latest';
const COOLDOWN_MS = 3 * 60 * 1000;
const DEFAULT_HEDGE_MS = 4000;
const DEADLINE_MS = 30 * 1000;
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
const hedgeMs = () => Number(process.env.GEMINI_HEDGE_MS) || DEFAULT_HEDGE_MS;

// model → time it may be asked first again
const coolingDown = new Map();

function modelChain() {
  const list = [process.env.GEMINI_MODEL || DEFAULT_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACKS).split(',')]
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

/** The chain with models that recently failed or were slow moved to the end. */
function orderedChain() {
  const now = Date.now();
  const chain = modelChain();
  return [...chain.filter((m) => !(coolingDown.get(m) > now)), ...chain.filter((m) => coolingDown.get(m) > now)];
}

/** POST one generateContent request to one model. */
async function httpTransport({ model, body, signal }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal,
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

/** Ask one model; resolves with the parsed answer or throws a GeminiError. */
async function ask(model, body, signal) {
  const data = await transport({ model, body, signal });
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
}

/**
 * One generateContent call, hedged across the model chain (see top of file).
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
async function generate({ systemInstruction, contents, tools, toolMode = 'AUTO', responseSchema, temperature = 0.4, deadlineMs = DEADLINE_MS }) {
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

  const models = orderedChain();
  return new Promise((resolve, reject) => {
    const pending = new Map(); // model → AbortController
    let next = 0;
    let settled = false;
    let lastError = null;
    let hedgeTimer = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadline);
      // Anything still running was slower than the winner: ask it later next time
      for (const [model, controller] of pending) {
        controller.abort();
        coolingDown.set(model, Date.now() + COOLDOWN_MS);
      }
      fn(value);
    };

    const launch = () => {
      clearTimeout(hedgeTimer);
      if (settled || next >= models.length) return;
      const model = models[next++];
      const controller = new AbortController();
      pending.set(model, controller);
      ask(model, body, controller.signal).then(
        (answer) => {
          pending.delete(model);
          finish(resolve, answer);
        },
        (err) => {
          pending.delete(model);
          if (settled) return;
          lastError = err instanceof GeminiError ? err : new GeminiError(err.message);
          console.error('[Gemini]', lastError.message);
          // A bad request fails the same way on every model
          if (!lastError.retryable) return finish(reject, lastError);
          coolingDown.set(model, Date.now() + COOLDOWN_MS);
          if (next < models.length) launch();
          else if (pending.size === 0) finish(reject, lastError);
        }
      );
      if (next < models.length) hedgeTimer = setTimeout(launch, hedgeMs());
    };

    const deadline = setTimeout(() => {
      console.error('[Gemini] No model answered in time');
      finish(reject, new GeminiError('No Gemini model answered in time', { retryable: true }));
    }, deadlineMs);

    launch();
  });
}

module.exports = { GeminiError, isConfigured, modelChain, generate, setTransport };
