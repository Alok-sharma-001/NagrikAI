"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_NAMES } from "@/lib/i18n";
import { speak, speechErrorText, stopSpeaking, useSpeechInput } from "@/lib/voice";
import type { Category, Text, Verdict } from "@/lib/types";
import { api, StatusBadge, usePrefs } from "./ui";

type Answer = { text: string; schemes: { id: string; name: Text; verdict: Verdict; category: Category; for?: string }[]; link?: { label: string; url: string }; suggestions?: Text[] };

const SUGGEST_GENERAL: Text[] = [
  { en: "Which schemes can my family get?", hi: "मेरे परिवार को कौन सी योजनाएँ मिल सकती हैं?" },
  { en: "How do I get a Samagra ID?", hi: "समग्र ID कैसे बनवाएँ?" },
  { en: "Scholarship for my children", hi: "बच्चों की पढ़ाई के लिए छात्रवृत्ति" },
  { en: "Help to build a house", hi: "घर बनाने के लिए मदद" },
  { en: "Free treatment in hospital", hi: "अस्पताल में मुफ़्त इलाज" },
];
const SUGGEST_SCHEME: Text[] = [
  { en: "Can I get this? Why?", hi: "क्या मुझे यह मिलेगी? क्यों?" },
  { en: "How do I apply?", hi: "आवेदन कैसे करूँ?" },
  { en: "Which documents are needed?", hi: "कौन से दस्तावेज़ चाहिए?" },
  { en: "Is there a last date?", hi: "क्या कोई अंतिम तिथि है?" },
];

/** "Ask anything" — voice or text question, grounded answer, read aloud. */
export default function AskSheet({ open, onClose, schemeId, memberId, schemeName }: { open: boolean; onClose: () => void; schemeId?: string; memberId?: string; schemeName?: string }) {
  const { lang, sound } = usePrefs();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<Answer | null>(null);
  const hi = lang === "hi";

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setQ(question);
    setBusy(true);
    setAns(null);
    try {
      const a = await api<Answer>("/api/ask", "POST", { question, lang, schemeId, memberId: memberId === "all" ? undefined : memberId });
      setAns(a);
      if (sound) speak(a.text, lang);
    } catch {
      setAns({ text: hi ? "नेटवर्क समस्या — फिर से कोशिश करें।" : "Network problem — please try again.", schemes: [] });
    } finally {
      setBusy(false);
    }
  };

  const { supported, listening, interim, error: micError, start, stop } = useSpeechInput(lang, ask);

  useEffect(() => {
    if (!open) {
      stopSpeaking();
      setAns(null);
      setQ("");
    }
  }, [open]);

  if (!open) return null;
  const suggestions = schemeId ? SUGGEST_SCHEME : SUGGEST_GENERAL;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-t-xl border-t-4 border-primary bg-bg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-4xl" aria-hidden>🤖</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{hi ? "कुछ भी पूछें" : "Ask anything"}</h2>
            {schemeName && <p className="truncate text-sm text-muted">{schemeName}</p>}
          </div>
          <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-xl" aria-label={hi ? "बंद करें" : "Close"}>✕</button>
        </div>

        <div className="flex flex-col items-center gap-2 py-2">
          {supported && (
            <button
              onClick={() => (listening ? stop() : start())}
              className={`flex h-24 w-24 items-center justify-center rounded-full text-5xl text-white shadow-lg ${listening ? "mic-live bg-accent" : "bg-primary"}`}
              aria-label={hi ? "बोलकर पूछें" : "Ask by voice"}
            >
              {listening ? "■" : "🎤"}
            </button>
          )}
          <p className="text-muted">{listening ? interim || (hi ? "सुन रहा हूँ… बोलिए" : "Listening… speak now") : hi ? "माइक दबाएँ और अपना सवाल बोलें" : "Tap the mic and say your question"}</p>
        </div>

        {micError && !listening && (
          <p role="alert" className="mt-1 rounded-md border border-bad/30 bg-bad-soft p-3 text-bad">
            🎤 {speechErrorText(micError, lang)}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={hi ? "या यहाँ लिखें…" : "Or type here…"}
            className="h-14 min-w-0 flex-1 rounded-md border-2 border-line bg-surface px-4 text-lg outline-none focus:border-primary"
          />
          <button type="submit" disabled={busy || !q.trim()} className="h-14 rounded-md bg-primary px-5 text-lg font-bold text-primary-ink disabled:opacity-40">
            {hi ? "पूछें" : "Ask"}
          </button>
        </form>

        {!ans && !busy && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.en} onClick={() => ask(s[lang])} className="rounded-full border border-primary/30 bg-primary-soft px-4 py-2 text-primary">
                {s[lang]}
              </button>
            ))}
          </div>
        )}

        {busy && <p className="mt-5 animate-pulse text-center text-lg text-muted">{hi ? "जवाब ढूँढ रहा हूँ…" : "Finding the answer…"}</p>}

        {ans && (
          <div className="mt-5 space-y-3">
            <div className="rounded-md bg-surface p-4 text-lg leading-relaxed shadow-sm">
              {ans.text}
              <button onClick={() => speak(ans.text, lang)} className="ml-2 align-middle" aria-label={hi ? "सुनें" : "Listen"}>🔊</button>
            </div>
            {ans.schemes.length > 0 && (
              <ul className="space-y-2">
                {ans.schemes.map((s) => (
                  <li key={s.id}>
                    <Link href={`/scheme/${s.id}`} onClick={onClose} className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
                      <span className="text-2xl" aria-hidden>{CATEGORY_NAMES[s.category].icon}</span>
                      <span className="min-w-0 flex-1 font-medium">
                        {s.name[lang]}
                        {s.for && s.verdict !== "ineligible" && <span className="block text-sm font-normal text-muted">👤 {s.for}</span>}
                      </span>
                      <StatusBadge verdict={s.verdict} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {ans.link && (
              <a href={ans.link.url} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-ink">
                🌐 {ans.link.label} — {new URL(ans.link.url).hostname}
              </a>
            )}
            {ans.suggestions && ans.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ans.suggestions.map((sg) => (
                  <button key={sg.en} onClick={() => ask(sg[lang])} className="rounded-full border border-primary/30 bg-primary-soft px-4 py-2 text-sm text-primary">
                    {sg[lang]}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setAns(null); setQ(""); }} className="w-full rounded-md border border-line py-3">{hi ? "दूसरा सवाल पूछें" : "Ask another question"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
