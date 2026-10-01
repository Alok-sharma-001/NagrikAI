"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { speak, stopSpeaking } from "@/lib/voice";
import { AppHeader, SiteFooter } from "./Shell";
import { usePrefs } from "./ui";
import type { AskFor, MatchResponse, Profile, ProfileField } from "@/lib/types";
import Chat, { type ChatMessage } from "./Chat";
import ProfilePanel from "./ProfilePanel";
import Results from "./Results";

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem("nagrik." + key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, v: unknown) {
    try {
      localStorage.setItem("nagrik." + key, JSON.stringify(v));
    } catch {
      /* storage unavailable — app still works for this session */
    }
  },
  clear() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("nagrik.")).forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

type ChatResponse = { reply: string; profile: Profile; extracted: Partial<Profile>; match: MatchResponse; mode: "llm" | "rules" };

export default function NagrikApp() {
  const { lang, sound: autoSpeak } = usePrefs();
  const [profile, setProfile] = useState<Profile>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [skip, setSkip] = useState<ProfileField[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"llm" | "rules" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lastAsked = useRef<ProfileField | undefined>(undefined);

  // Restore saved state.
  useEffect(() => {
    const savedProfile = store.get<Profile>("profile", {});
    setProfile(savedProfile);
    setMessages(store.get<ChatMessage[]>("messages", []));
    setSkip(store.get<ProfileField[]>("skip", []));
    setLoaded(true);
    if (Object.keys(savedProfile).length) {
      postJSON<MatchResponse>("/api/match", { profile: savedProfile }).then(setMatch).catch(() => {});
    }
  }, []);

  useEffect(() => { if (loaded) store.set("profile", profile); }, [profile, loaded]);
  useEffect(() => { if (loaded) store.set("messages", messages.slice(-40)); }, [messages, loaded]);
  useEffect(() => { if (loaded) store.set("skip", skip); }, [skip, loaded]);

  const applyChat = useCallback(
    (res: ChatResponse) => {
      setProfile(res.profile);
      setMatch(res.match);
      setMode(res.mode);
      const ask: AskFor | undefined = res.match.askFor[0];
      lastAsked.current = ask?.field;
      setMessages((m) => [...m, { role: "assistant", text: res.reply, ask, extracted: res.extracted }]);
      if (autoSpeak) speak(res.reply, lang);
    },
    [autoSpeak, lang],
  );

  const send = useCallback(
    async (text: string, answer?: { field: ProfileField; value: unknown }) => {
      if (!text.trim() || busy) return;
      stopSpeaking();
      setMessages((m) => [...m, { role: "user", text }]);
      setBusy(true);
      try {
        applyChat(
          await postJSON<ChatResponse>("/api/chat", { lang, profile, message: text, lastAsked: lastAsked.current, skip, answer }),
        );
      } catch {
        setMessages((m) => [...m, { role: "assistant", text: t("networkError", lang) }]);
      } finally {
        setBusy(false);
      }
    },
    [applyChat, busy, lang, profile, skip],
  );

  /** Profile edited directly (form or inline answer on a card) — re-run rules only. */
  const updateProfile = useCallback(
    async (patch: Partial<Profile>, removed: ProfileField[] = []) => {
      const next: Profile = { ...profile, ...patch };
      for (const k of removed) delete next[k];
      setProfile(next);
      try {
        setMatch(await postJSON<MatchResponse>("/api/match", { profile: next, skip }));
      } catch {}
    },
    [profile, skip],
  );

  const skipField = useCallback(
    async (field: ProfileField) => {
      const nextSkip = [...skip, field];
      setSkip(nextSkip);
      try {
        const m = await postJSON<MatchResponse>("/api/match", { profile, skip: nextSkip });
        setMatch(m);
        lastAsked.current = m.askFor[0]?.field;
        if (m.askFor[0]) setMessages((prev) => [...prev, { role: "assistant", text: m.askFor[0].question[lang], ask: m.askFor[0] }]);
      } catch {}
    },
    [lang, profile, skip],
  );

  const clearAll = () => {
    stopSpeaking();
    store.clear();
    setProfile({});
    setMessages([]);
    setMatch(null);
    setSkip([]);
    lastAsked.current = undefined;
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader title={lang === "hi" ? "तुरंत जाँचें — बिना पंजीकरण" : "Quick check — no registration"} />
      <div className="no-print border-b border-line bg-accent-soft">
        <p className="mx-auto max-w-6xl px-4 py-2 text-sm">
          💡 {lang === "hi" ? "यह जाँच इसी फ़ोन पर रहती है। पूरे परिवार की योजनाएँ हमेशा के लिए देखने के लिए" : "This check stays on this phone. To keep your whole family's schemes,"}{" "}
          <a href="/register" className="font-semibold text-primary underline">{lang === "hi" ? "परिवार का पंजीकरण करें" : "register your family"}</a>
          {mode && <span className="ml-2 text-muted">· {mode === "llm" ? t("modeLLM", lang) : t("modeRules", lang)}</span>}
        </p>
      </div>

      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-4 py-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="flex min-w-0 flex-col gap-4 no-print">
          <Chat lang={lang} messages={messages} busy={busy} onSend={send} onSkip={skipField} />
          <ProfilePanel lang={lang} profile={profile} onChange={updateProfile} onClear={clearAll} />
        </section>
        <section id="results" className="min-w-0 scroll-mt-20">
          <Results lang={lang} profile={profile} match={match} onAnswer={updateProfile} />
        </section>
      </main>

      {match && match.eligible.length > 0 && (
        <a
          href="#results"
          className="no-print fixed bottom-4 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-good px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
        >
          ✓ {match.eligible.length} {t("schemesFor", lang)} ↓
        </a>
      )}

      <SiteFooter />
    </div>
  );
}
