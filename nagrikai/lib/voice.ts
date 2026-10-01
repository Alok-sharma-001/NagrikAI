"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./types";

const LOCALE: Record<Lang, string> = { hi: "hi-IN", en: "en-IN" };

/* ---------- Speech-to-text ---------- */

// The Web Speech API isn't in TypeScript's DOM lib; keep the surface we use minimal.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ---------- Recording for server-side recognition (works in every browser) ---------- */

type Recorder = { stop: () => void; cancel: () => void };

/** PCM samples → 16 kHz mono 16-bit WAV. */
function encodeWav(chunks: Float32Array[], inRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const ratio = inRate / 16000;
  const n = Math.floor(all.length / ratio);
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (off: number, t: string) => { for (let i = 0; i < t.length; i++) view.setUint8(off + i, t.charCodeAt(i)); };
  str(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // average the source samples that fall into this output sample (simple low-pass)
    const from = Math.floor(i * ratio), to = Math.min(all.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += all[j];
    const v = Math.max(-1, Math.min(1, to > from ? sum / (to - from) : 0));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

/**
 * Record from the microphone until the speaker pauses (or `stop()` is called).
 * Resolves `onDone` with a WAV blob, or null when nothing was said.
 */
async function recordUntilSilence(onDone: (wav: Blob | null) => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0; // the processor must be connected to run, but we don't want to hear ourselves
  const chunks: Float32Array[] = [];
  const started = performance.now();
  let spokeAt = 0;
  let quietSince = 0;
  let finished = false;

  const finish = (keep: boolean) => {
    if (finished) return;
    finished = true;
    node.disconnect(); source.disconnect(); mute.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.sampleRate;
    ctx.close().catch(() => {});
    onDone(keep && spokeAt ? encodeWav(chunks, rate) : null);
  };

  node.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const loud = Math.sqrt(sum / data.length) > 0.015;
    const now = performance.now();
    if (loud) { spokeAt ||= now; quietSince = 0; }
    else if (spokeAt) quietSince ||= now;
    if (spokeAt && quietSince && now - quietSince > 1600) finish(true); // paused after speaking
    else if (!spokeAt && now - started > 7000) finish(false); // never spoke
    else if (now - started > 25000) finish(true); // hard cap
  };
  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);
  return { stop: () => finish(true), cancel: () => finish(false) };
}

let serverStt: Promise<boolean> | null = null;
/** Does our server offer speech-to-text? Asked once per page load. */
const serverSttAvailable = () =>
  (serverStt ??= fetch("/api/transcribe").then((r) => r.json()).then((d: { available?: boolean }) => !!d.available).catch(() => false));

const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window.AudioContext !== "undefined";
/** Brave ships the recognition API but blocks the service behind it. */
const browserSttBlocked = () => typeof navigator !== "undefined" && "brave" in navigator;
const prefersServer = () => { try { return localStorage.getItem("nagrik.stt") === "server"; } catch { return false; } };
const rememberServer = () => { try { localStorage.setItem("nagrik.stt", "server"); } catch {} };

/**
 * Voice input that works in every browser:
 *  - Chrome / Edge: the browser's own recognition (free, shows words as you speak);
 *  - Brave, Firefox, Safari — or whenever the browser's recognition fails: record the
 *    audio and let the server transcribe it.
 */
export function useSpeechInput(lang: Lang, onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  /** Why listening failed, as an error code (e.g. "network", "not-allowed"); null when fine. */
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (getRecognitionCtor() !== null && !browserSttBlocked()) return setSupported(true);
    if (!canRecord()) return;
    serverSttAvailable().then(setSupported);
  }, []);

  const startServer = useCallback(async () => {
    if (!window.isSecureContext) return setError("insecure");
    setError(null);
    setListening(true);
    setInterim("");
    try {
      recorderRef.current = await recordUntilSilence(async (wav) => {
        recorderRef.current = null;
        if (!wav) {
          setListening(false);
          return setError("no-speech");
        }
        setInterim(lang === "hi" ? "समझ रहा हूँ…" : "Understanding…");
        try {
          const res = await fetch(`/api/transcribe?lang=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
          const data = (await res.json()) as { text?: string };
          if (!res.ok) throw new Error(String(res.status));
          const text = (data.text ?? "").trim();
          if (text) onFinalRef.current(text);
          else setError("no-speech");
        } catch {
          setError("server");
        } finally {
          setInterim("");
          setListening(false);
        }
      });
    } catch (e) {
      setListening(false);
      const name = (e as DOMException).name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : name === "NotFoundError" ? "audio-capture" : "unknown");
    }
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    stopSpeaking();
    const Ctor = getRecognitionCtor();
    const server = canRecord() && (await serverSttAvailable());
    if (server && (!Ctor || browserSttBlocked() || prefersServer())) return startServer();
    if (!Ctor) return setError("unsupported");

    const rec = new Ctor();
    rec.lang = LOCALE[lang];
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";
    setError(null);
    let switched = false;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else live += r[0].transcript;
      }
      setInterim((finalRef.current + live).trim());
    };
    rec.onerror = (e) => {
      // The browser has the API but not the service (Chromium builds): use the server from now on.
      if ((e.error === "network" || e.error === "service-not-allowed") && server) {
        switched = true;
        rememberServer();
        recRef.current = null;
        return void startServer();
      }
      setListening(false);
      if (e.error !== "aborted") setError(e.error || "unknown"); // "aborted" is us stopping it
    };
    rec.onend = () => {
      if (switched) return;
      setListening(false);
      const text = finalRef.current.trim();
      setInterim("");
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError("unknown");
    }
  }, [lang, startServer]);

  return { supported, listening, interim, error, start, stop };
}

/** What to tell the user when voice input fails. */
export function speechErrorText(code: string, lang: Lang): string {
  const hi = lang === "hi";
  switch (code) {
    case "network":
    case "service-not-allowed":
      // Brave, Chromium and some other browsers ship the API but block the speech service.
      return hi
        ? "इस ब्राउज़र में आवाज़ पहचान नहीं चलती (जैसे Brave / Chromium)। कृपया Google Chrome में खोलें, या अपना सवाल लिखें।"
        : "Voice recognition doesn't work in this browser (e.g. Brave / Chromium). Please open in Google Chrome, or type your question.";
    case "not-allowed":
      return hi
        ? "माइक की अनुमति नहीं मिली। ऊपर पते के पास 🔒 दबाकर माइक्रोफ़ोन चालू करें, फिर दोबारा कोशिश करें।"
        : "Microphone permission was denied. Tap the 🔒 near the address bar, allow the microphone, and try again.";
    case "audio-capture":
      return hi ? "माइक्रोफ़ोन नहीं मिला। माइक जोड़कर दोबारा कोशिश करें।" : "No microphone found. Connect one and try again.";
    case "insecure":
      return hi
        ? "इस पते पर माइक नहीं चल सकता — ब्राउज़र माइक केवल सुरक्षित (https) पते या इसी कंप्यूटर (localhost) पर देता है। कृपया लिखकर पूछें।"
        : "The microphone can't be used at this address — browsers allow it only on secure (https) pages or on this computer (localhost). Please type instead.";
    case "server":
      return hi ? "आवाज़ समझने की सेवा अभी उपलब्ध नहीं है। थोड़ी देर बाद कोशिश करें या लिखकर पूछें।" : "The speech service isn't available right now. Try again shortly, or type instead.";
    case "unsupported":
      return hi ? "इस ब्राउज़र में आवाज़ से जवाब देना उपलब्ध नहीं है। कृपया लिखकर पूछें।" : "Voice input isn't available in this browser. Please type instead.";
    case "no-speech":
      return hi ? "कुछ सुनाई नहीं दिया। माइक दबाकर थोड़ा ज़ोर से बोलें।" : "I didn't hear anything. Tap the mic and speak a little louder.";
    default:
      return hi ? "आवाज़ पहचान में दिक्कत हुई। दोबारा कोशिश करें या लिखें।" : "Voice input had a problem. Try again or type instead.";
  }
}

/* ---------- Text-to-speech ---------- */

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const want = LOCALE[lang].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ??
    undefined
  );
}

export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onEnd?.();
  const synth = window.speechSynthesis;
  synth.cancel();
  // Chrome cuts off long utterances, so speak sentence by sentence.
  const chunks = text
    .replace(/[₹]/g, lang === "hi" ? " रुपये " : " rupees ")
    .split(/(?<=[।.!?])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const voice = pickVoice(lang);
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = LOCALE[lang];
    if (voice) u.voice = voice;
    u.rate = lang === "hi" ? 0.95 : 1;
    if (i === chunks.length - 1 && onEnd) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
