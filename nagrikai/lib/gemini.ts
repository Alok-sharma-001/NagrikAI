/**
 * Minimal Google Gemini client over REST (no SDK needed). The key travels in a
 * header — never in the URL — and only to Google's API host.
 */

const HOST = "https://generativelanguage.googleapis.com/v1beta";
/**
 * Models tried in order. The default favours speed and availability for a chat product
 * (flash-lite answers in ~1 s and has the roomiest free quota);
 * when one is overloaded (429/5xx) or times out, the next is tried, so a busy model
 * never surfaces to the citizen. NAGRIK_MODEL puts another model first.
 */
const CHAIN = [...new Set([process.env.NAGRIK_MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"].filter((m): m is string => !!m && m.startsWith("gemini")))];

/** A model that just said "quota exceeded" or "overloaded" is skipped for a while instead of being asked again every time. */
const coolUntil = new Map<string, number>();
const cooling = (model: string) => (coolUntil.get(model) ?? 0) > Date.now();
const cool = (model: string, status: number) => coolUntil.set(model, Date.now() + (status === 429 ? 10 * 60_000 : 60_000));
export const GEMINI_MODEL = CHAIN[0];

type Schema = { type: string; nullable?: boolean; enum?: string[]; items?: Schema; properties?: Record<string, Schema>; required?: string[] };

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean; audioTranscription?: { text?: string } }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string };
};

async function call(body: Record<string, unknown>): Promise<string> {
  let last = new Error("gemini: no model available");
  // Skip models that are cooling off — unless every one is, in which case try them all anyway.
  const order = CHAIN.some((m) => !cooling(m)) ? CHAIN.filter((m) => !cooling(m)) : CHAIN;
  for (const model of order) {
    try {
      const res = await fetch(`${HOST}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      const data = (await res.json().catch(() => ({}))) as GeminiResponse;
      if (!res.ok) {
        last = new Error(`gemini ${model} ${res.status}: ${data.error?.message?.slice(0, 160) ?? "request failed"}`);
        if (res.status === 401 || res.status === 403) throw last; // bad or unauthorised key: no model will help
        if (res.status === 429 || res.status >= 500) cool(model, res.status);
        continue; // busy, out of quota, retired, or doesn't accept a setting → next model
      }
      if (data.promptFeedback?.blockReason) throw new Error(`gemini blocked: ${data.promptFeedback.blockReason}`);
      const c = data.candidates?.[0];
      const text = (c?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
      if (text) return text;
      last = new Error(`gemini ${model} empty response (${c?.finishReason ?? "no candidate"})`);
    } catch (e) {
      const err = e as Error;
      // Only a timeout moves on to the next model; anything else thrown above is final.
      if (err.name !== "TimeoutError" && err.name !== "AbortError") throw err;
      last = new Error(`gemini ${model} timed out`);
    }
  }
  throw last;
}

// Our two jobs (pull facts out of a sentence; rephrase an answer the rules already decided) need no
// deliberation — minimal thinking cuts latency from ~5s to ~1.5s.
const FAST = { thinkingConfig: { thinkingLevel: "minimal" } };

const base = (system: string, user: string) => ({
  systemInstruction: { parts: [{ text: system }] },
  contents: [{ role: "user", parts: [{ text: user }] }],
});

export function geminiText(system: string, user: string): Promise<string> {
  return call({ ...base(system, user), generationConfig: { temperature: 0.2, maxOutputTokens: 4096, ...FAST } });
}

/** JSON constrained to `schema` (Gemini's OpenAPI-style schema). Returns the parsed object. */
export async function geminiJson(system: string, user: string, schema: Schema): Promise<Record<string, unknown>> {
  const text = await call({
    ...base(system, user),
    generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: schema, ...FAST },
  });
  return JSON.parse(text) as Record<string, unknown>;
}

export type { Schema as GeminiSchema };

/**
 * Speech → text. Tries the dedicated transcription model first, then a general model
 * with an instruction. Audio is sent to Google for this one request and not stored by us.
 */
export async function geminiTranscribe(audioBase64: string, mimeType: string, lang: "hi" | "en"): Promise<string> {
  const audio = { inlineData: { mimeType, data: audioBase64 } };
  const instruction =
    lang === "hi"
      ? "Transcribe this audio exactly as spoken. If it is Hindi, write it in Devanagari. Output only the transcript, nothing else. If there is no speech, output nothing."
      : "Transcribe this audio exactly as spoken. Output only the transcript, nothing else. If there is no speech, output nothing.";
  const attempts: [string, Record<string, unknown>][] = [
    ["gemini-3.5-transcribe", { contents: [{ role: "user", parts: [audio] }] }],
    ["gemini-3.5-flash-lite", { contents: [{ role: "user", parts: [audio, { text: instruction }] }], generationConfig: { temperature: 0, maxOutputTokens: 1024 } }],
  ];
  let last = new Error("transcription unavailable");
  for (const [model, body] of attempts) {
    try {
      const res = await fetch(`${HOST}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as GeminiResponse;
      if (!res.ok) {
        last = new Error(`gemini ${model} ${res.status}: ${data.error?.message?.slice(0, 120) ?? "failed"}`);
        if (res.status === 401 || res.status === 403) throw last;
        continue;
      }
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      return parts.map((p) => p.audioTranscription?.text ?? (p.thought ? "" : (p.text ?? ""))).join(" ").trim();
    } catch (e) {
      const err = e as Error;
      if (err.name !== "TimeoutError" && err.name !== "AbortError") throw err;
      last = new Error(`gemini ${model} timed out`);
    }
  }
  throw last;
}
