"use client";

import { useEffect, useRef, useState } from "react";
import { EXAMPLES, t } from "@/lib/i18n";
import { FIELD_NAMES, formatProfileValue } from "@/lib/labels";
import { speak, speechErrorText, useSpeechInput } from "@/lib/voice";
import type { AskFor, Lang, Profile, ProfileField } from "@/lib/types";

export type ChatMessage = { role: "user" | "assistant"; text: string; ask?: AskFor; extracted?: Partial<Profile> };

type Props = {
  lang: Lang;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string, answer?: { field: ProfileField; value: unknown }) => void;
  onSkip: (field: ProfileField) => void;
};

export default function Chat({ lang, messages, busy, onSend, onSkip }: Props) {
  const [draft, setDraft] = useState("");
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { supported, listening, interim, error: micError, start, stop } = useSpeechInput(lang, (text) => onSend(text));

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, interim]);

  const last = messages[messages.length - 1];
  const pendingAsk = last?.role === "assistant" ? last.ask : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(draft);
    setDraft("");
  };

  const mic = () => {
    if (!supported) return setVoiceMsg(t("voiceUnsupported", lang));
    setVoiceMsg(null);
    if (listening) stop();
    else start();
  };

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm lg:h-[calc(100dvh-230px)]">
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <Bubble role="assistant" lang={lang} text={t("greeting", lang)} />
        {messages.length === 0 && (
          <div className="pl-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("example", lang)}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label.en}
                  onClick={() => onSend(ex.text[lang])}
                  className="rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-left text-sm text-primary"
                >
                  {ex.label[lang]}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <Bubble role={m.role} lang={lang} text={m.text} />
            {m.extracted && Object.keys(m.extracted).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                {(Object.keys(m.extracted) as ProfileField[]).map((k) => (
                  <span key={k} className="rounded-md bg-good-soft px-2 py-0.5 text-xs text-good">
                    ✓ {FIELD_NAMES[k][lang]}: {formatProfileValue(k, m.extracted![k], lang)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="animate-pulse pl-1 text-sm text-muted">{t("thinking", lang)}</p>}
        {listening && (
          <p className="rounded-xl border border-dashed border-accent bg-accent-soft px-3 py-2 text-right text-sm">
            {interim || t("listening", lang)}
          </p>
        )}
      </div>

      {pendingAsk && pendingAsk.options.length > 0 && !busy && (
        <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2 px-4 py-3">
          {pendingAsk.options.map((o) => (
            <button
              key={String(o.value)}
              onClick={() => onSend(o.label[lang], { field: pendingAsk.field, value: o.value })}
              className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:border-primary"
            >
              {o.label[lang]}
            </button>
          ))}
          <button onClick={() => onSkip(pendingAsk.field)} className="min-h-11 rounded-full px-3 text-sm text-muted underline">
            {lang === "hi" ? "पता नहीं / छोड़ें" : "Not sure / skip"}
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        <button
          type="button"
          onClick={mic}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl text-white ${listening ? "mic-live bg-accent" : "bg-primary"}`}
          aria-label={listening ? t("listening", lang) : t("tapToSpeak", lang)}
          title={t("tapToSpeak", lang)}
        >
          {listening ? "■" : "🎤"}
        </button>
        <label className="sr-only" htmlFor="chat-input">{t("askPlaceholder", lang)}</label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          rows={1}
          placeholder={t("askPlaceholder", lang)}
          className="min-h-14 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-3.5 outline-none focus:border-primary"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="h-14 rounded-xl bg-primary px-4 font-medium text-primary-ink disabled:opacity-40">
          {t("send", lang)}
        </button>
      </form>
      {voiceMsg && <p className="px-4 pb-3 text-xs text-bad">{voiceMsg}</p>}
      {micError && !listening && <p role="alert" className="px-4 pb-3 text-sm text-bad">🎤 {speechErrorText(micError, lang)}</p>}
    </div>
  );
}

function Bubble({ role, text, lang }: { role: "user" | "assistant"; text: string; lang: Lang }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-4 py-2.5 leading-relaxed ${
          mine ? "rounded-br-sm bg-primary text-primary-ink" : "rounded-bl-sm bg-surface-2"
        }`}
      >
        {text}
        {!mine && (
          <button onClick={() => speak(text, lang)} className="ml-2 align-middle text-sm opacity-60 hover:opacity-100" aria-label={t("listen", lang)}>
            🔊
          </button>
        )}
      </div>
    </div>
  );
}
