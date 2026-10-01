"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { speak, stopSpeaking } from "@/lib/voice";
import type { Lang, Text, Verdict } from "@/lib/types";

/* ---------- Language + sound preferences (per device) ---------- */

type Prefs = {
  lang: Lang;
  setLang: (l: Lang) => void;
  sound: boolean;
  setSound: (s: boolean) => void;
  say: (t: string) => void;
  /** Text size step for the अ- / अ / अ+ control: 0 = small, 1 = normal, 2 = large, 3 = extra large. */
  textSize: number;
  setTextSize: (n: number) => void;
};
const TEXT_SIZES = [14, 16, 18, 20];
const PrefsContext = createContext<Prefs | null>(null);

const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem("nagrik." + k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem("nagrik." + k, JSON.stringify(v));
  } catch {}
};

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("hi");
  const [sound, setSoundState] = useState(true);
  const [textSize, setTextSizeState] = useState(1);
  useEffect(() => {
    setLangState(read<Lang>("lang", "hi"));
    setSoundState(read<boolean>("autoSpeak", true));
    setTextSizeState(read<number>("textSize", 1));
  }, []);
  useEffect(() => {
    document.documentElement.style.fontSize = `${TEXT_SIZES[textSize] ?? 16}px`;
  }, [textSize]);
  const setTextSize = (n: number) => {
    const v = Math.max(0, Math.min(TEXT_SIZES.length - 1, n));
    setTextSizeState(v);
    write("textSize", v);
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    stopSpeaking();
    setLangState(l);
    write("lang", l);
  };
  const setSound = (s: boolean) => {
    if (!s) stopSpeaking();
    setSoundState(s);
    write("autoSpeak", s);
  };
  const say = useCallback(
    (t: string) => {
      if (sound) speak(t, lang);
    },
    [sound, lang],
  );
  return <PrefsContext.Provider value={{ lang, setLang, sound, setSound, say, textSize, setTextSize }}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const p = useContext(PrefsContext);
  if (!p) throw new Error("usePrefs outside PrefsProvider");
  return p;
}

/** Pick the current-language string. */
export function useT() {
  const { lang } = usePrefs();
  return (t: Text) => t[lang];
}

/* ---------- Small building blocks ---------- */

export function SpeakButton({ text, className = "", label }: { text: string; className?: string; label?: string }) {
  const { lang } = usePrefs();
  return (
    <button
      onClick={() => speak(text, lang)}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-surface px-3 text-lg ${className}`}
      aria-label={lang === "hi" ? "सुनें" : "Listen"}
    >
      🔊{label && <span className="text-base font-semibold">{label}</span>}
    </button>
  );
}

export const VERDICT_STYLE: Record<Verdict, { icon: string; cls: string; label: Text }> = {
  eligible: { icon: "✓", cls: "bg-good text-white", label: { en: "You can get it", hi: "मिल सकती है" } },
  possible: { icon: "?", cls: "bg-warn-soft text-warn", label: { en: "Maybe — answer 1 question", hi: "शायद — 1 सवाल का जवाब दें" } },
  ineligible: { icon: "✗", cls: "bg-surface-2 text-muted", label: { en: "Not for you now", hi: "अभी आपके लिए नहीं" } },
};

export function StatusBadge({ verdict, compact }: { verdict: Verdict; compact?: boolean }) {
  const { lang } = usePrefs();
  const v = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${v.cls}`}>
      <span aria-hidden>{v.icon}</span>
      {!compact && v.label[lang]}
      {compact && <span className="sr-only">{v.label[lang]}</span>}
    </span>
  );
}

export function BigButton({
  href,
  onClick,
  icon,
  label,
  sub,
  tone = "surface",
}: {
  href?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  sub?: string;
  tone?: "primary" | "surface" | "good";
}) {
  const cls = {
    primary: "bg-primary text-primary-ink border-primary",
    good: "bg-good text-white border-good",
    surface: "bg-surface border-line",
  }[tone];
  const inner = (
    <>
      <IconBadge icon={icon} size="sm" tone={tone === "surface" ? "blue" : "grey"} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-base font-bold leading-tight">{label}</span>
        {sub && <span className="mt-0.5 block text-sm opacity-80">{sub}</span>}
      </span>
      <span className="text-2xl opacity-60" aria-hidden>›</span>
    </>
  );
  const c = `flex min-h-16 w-full items-center gap-4 rounded-lg border px-5 py-3 shadow-sm transition hover:shadow-md active:scale-[0.99] ${cls}`;
  return href ? <Link href={href} className={c}>{inner}</Link> : <button onClick={onClick} className={c}>{inner}</button>;
}

export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), { status: res.status, code: data?.error?.code });
  return data as T;
}

/** Picture icon in a soft circle — keeps the pictorial style but looks tidy. */
export function IconBadge({ icon, size = "md", tone = "blue" }: { icon: string; size?: "sm" | "md" | "lg"; tone?: "blue" | "green" | "saffron" | "grey" }) {
  const s = { sm: "h-10 w-10 text-xl", md: "h-14 w-14 text-3xl", lg: "h-20 w-20 text-5xl" }[size];
  const t = { blue: "bg-primary-soft", green: "bg-good-soft", saffron: "bg-accent-soft", grey: "bg-surface-2" }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${s} ${t}`} aria-hidden>
      {icon}
    </span>
  );
}

/** White panel with a titled header bar, like form sections on government portals. */
export function Panel({ title, icon, children, className = "", action }: { title?: string; icon?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-line bg-surface shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
          {icon && <span aria-hidden>{icon}</span>}
          <h2 className="flex-1 text-base font-bold text-primary">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Small labels on a scheme: who runs it, and whether it is taking new registrations. */
export function SchemeTags({ scheme }: { scheme: { scope?: "central" | "mp"; intakeClosed?: boolean; eventBased?: Text } }) {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  return (
    <>
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${scheme.scope === "mp" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>
        {scheme.scope === "mp" ? (hi ? "मध्यप्रदेश शासन" : "Govt. of MP") : hi ? "भारत सरकार" : "Govt. of India"}
      </span>
      {scheme.intakeClosed && (
        <span className="rounded bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">⏸ {hi ? "नए पंजीयन अभी बंद" : "New registrations closed"}</span>
      )}
      {scheme.eventBased && <span className="rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">📅 {scheme.eventBased[lang]}</span>}
    </>
  );
}
