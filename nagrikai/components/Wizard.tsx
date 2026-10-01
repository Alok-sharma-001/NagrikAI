"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractProfileRules, matchSpokenOption, parseNumber } from "@/lib/extract";
import { speechErrorText, useSpeechInput } from "@/lib/voice";
import { visibleSteps, type Answers, type Step, type WizardMode } from "@/lib/wizard";
import { IconBadge, usePrefs } from "./ui";
import { AppHeader } from "./Shell";

type Props = {
  mode: WizardMode;
  title: string;
  initial?: Answers;
  /** Questions already answered from a trusted source (e.g. the Samagra registry) — never asked. */
  hide?: (keyof Answers)[];
  submitLabel: { en: string; hi: string };
  onSubmit: (a: Answers) => Promise<{ error?: string; goTo?: keyof Answers } | void>;
  onExit: () => void;
};

const MSG = {
  notUnderstood: { en: "Sorry, I didn't catch that. Please say it again, or tap a picture.", hi: "माफ़ कीजिए, समझ नहीं आया। फिर से बोलें या तस्वीर दबाएँ।" },
  skip: { en: "Don't know / skip", hi: "पता नहीं / छोड़ें" },
  next: { en: "Next", hi: "आगे" },
  back: { en: "Back", hi: "पीछे" },
  speak: { en: "Speak", hi: "बोलें" },
  listening: { en: "Listening…", hi: "सुन रहा हूँ…" },
  review: { en: "Please check once", hi: "एक बार जाँच लें" },
  reviewHint: { en: "Tap anything to change it", hi: "कुछ भी बदलने के लिए उस पर दबाएँ" },
  notAnswered: { en: "Skipped", hi: "छोड़ा" },
  pinAgain: { en: "Enter the same PIN again", hi: "वही PIN दोबारा डालें" },
  pinMismatch: { en: "PINs didn't match. Try again.", hi: "PIN मेल नहीं खाया। फिर से डालें।" },
  badMobile: { en: "Enter a 10-digit mobile number starting with 6, 7, 8 or 9", hi: "6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का नंबर डालें" },
  consentYes: { en: "Yes, I agree", hi: "हाँ, मैं सहमत हूँ" },
  consentNo: { en: "No", hi: "नहीं" },
  consentNeeded: { en: "Without saving we can't remember you. You can still check schemes without registering.", hi: "सुरक्षित किए बिना हम आपको याद नहीं रख सकते। आप बिना पंजीकरण के भी योजनाएँ जाँच सकते हैं।" },
  saving: { en: "Saving…", hi: "सुरक्षित कर रहे हैं…" },
  typeHere: { en: "Type here", hi: "यहाँ लिखें" },
} as const;

const HOME_STEPS = new Set(["area", "district", "isPVTG", "income", "category", "isMinority", "ration", "house", "hasLpgConnection", "hasToilet", "landHectares", "breadwinnerDiedRecently"]);
const SECTION = {
  family: { en: "Family", hi: "परिवार" },
  person: { en: "Personal details", hi: "व्यक्तिगत जानकारी" },
  home: { en: "Home details", hi: "घर की जानकारी" },
  account: { en: "Create account", hi: "खाता बनाएँ" },
};
const sectionOf = (s: Step) =>
  ["code", "relation"].includes(s.id) ? SECTION.family : HOME_STEPS.has(s.id) ? SECTION.home : ["mobile", "pin", "consent"].includes(s.id) ? SECTION.account : SECTION.person;

/** Map a spoken answer to the step's value. */
function interpret(step: Step, text: string): unknown {
  const t = text.trim();
  switch (step.kind) {
    case "number": {
      const n = extractProfileRules(t).age ?? parseNumber(t);
      return n !== null && n !== undefined && n >= (step.min ?? 0) && n <= (step.max ?? 1e9) ? Math.round(n) : undefined;
    }
    case "text":
      return t.replace(/^(मेरा नाम|मेरी बेटी का नाम|मेरे बेटे का नाम|नाम|my name is|name is|name)\s*/i, "").replace(/\s*(है|hai|हैं)\.?$/i, "").trim() || undefined;
    case "code":
      return t.replace(/\s+/g, "").toUpperCase();
    case "mobile": {
      const digits = t.replace(/\D/g, "");
      return digits.length === 10 ? digits : undefined;
    }
    case "choice": {
      if (step.id === "income") {
        let n = parseNumber(t);
        if (n === null) break;
        if (/(हज़ार|हजार|thousand|k\b)/i.test(t)) n *= 1000;
        if (/(लाख|lakh)/i.test(t)) n *= 100000;
        if (/(साल|year|annual|वार्षिक)/i.test(t)) n /= 12;
        return step.options!.find((o) => n! <= (o.value as number))?.value ?? step.options!.at(-1)!.value;
      }
      if (step.id === "ration" && extractProfileRules(t).isBPL === true) return "priority";
      if (step.id === "landHectares") {
        const ha = extractProfileRules(t).landHectares;
        if (ha !== undefined) return step.options!.find((o) => ha <= (o.value as number))?.value ?? 4;
      }
      return matchSpokenOption(t, step.voiceField, step.options!);
    }
  }
  return undefined;
}

const NONE: (keyof Answers)[] = [];

export default function Wizard({ mode, title, initial = {}, hide = NONE, submitLabel, onSubmit, onExit }: Props) {
  const { lang, say } = usePrefs();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [i, setI] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const vis = useCallback((a: Answers) => visibleSteps(a, mode).filter((s) => !hide.includes(s.id)), [mode, hide]);
  const steps = useMemo(() => vis(answers), [answers, vis]);
  const step = steps[Math.min(i, steps.length - 1)];
  const returnToReview = useRef(false);

  // Read each question aloud as it appears.
  useEffect(() => {
    if (reviewing || !step) return;
    const opts = step.options && step.options.length <= 6 ? " " + step.options.map((o) => o.label[lang]).join(", ") : "";
    say(`${step.question[lang]}${opts}`);
    setError(null);
  }, [step?.id, reviewing, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = (next: Answers) => {
    if (returnToReview.current) {
      returnToReview.current = false;
      return setReviewing(true);
    }
    const nextSteps = vis(next);
    const pos = nextSteps.findIndex((s) => s.id === step.id);
    if (pos + 1 >= nextSteps.length) setReviewing(true);
    else setI(pos + 1);
  };

  const answer = (value: unknown) => {
    const next = { ...answers, [step.id]: value } as Answers;
    setAnswers(next);
    setTimeout(() => advance(next), 220); // brief pause so the tap feels acknowledged
  };

  const skip = () => {
    const next = { ...answers };
    delete next[step.id];
    setAnswers(next);
    advance(next);
  };

  const goBack = () => {
    if (reviewing) return setReviewing(false);
    if (i === 0) return onExit();
    setI(i - 1);
  };

  const { supported, listening, interim, error: micError, start, stop } = useSpeechInput(lang, (text) => {
    const v = interpret(step, text);
    if (v === undefined) {
      setError(MSG.notUnderstood[lang]);
      say(MSG.notUnderstood[lang]);
    } else answer(v);
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    type Result = { error?: string; goTo?: keyof Answers } | void;
    const res: Result = await onSubmit(answers).catch((e: Error): Result => ({ error: e.message }));
    setBusy(false);
    if (res && res.error) {
      setError(res.error);
      say(res.error);
      if (res.goTo) {
        const pos = vis(answers).findIndex((s) => s.id === res.goTo);
        if (pos >= 0) {
          returnToReview.current = true;
          setReviewing(false);
          setI(pos);
        }
      }
    }
  };

  if (reviewing) {
    const shown = vis(answers).filter((s) => !["pin", "consent", "code"].includes(s.kind));
    return (
      <div className="min-h-dvh bg-bg">
        <AppHeader back={goBack} title={title} compact />
        <main id="main" className="mx-auto max-w-3xl px-4 py-5 pb-32">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <div className="border-b border-line bg-primary px-5 py-3 text-primary-ink">
            <p className="text-sm opacity-90">{lang === "hi" ? "अंतिम चरण" : "Final step"}</p>
            <h2 className="text-xl font-bold">{MSG.review[lang]}</h2>
          </div>
          <div className="space-y-3 p-4">
          <p className="text-muted">{MSG.reviewHint[lang]}</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {shown.map((s) => {
              const v = answers[s.id];
              const o = s.options?.find((x) => x.value === v);
              const display = v === undefined ? MSG.notAnswered[lang] : o ? `${o.icon} ${o.label[lang]}` : String(v);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      returnToReview.current = true;
                      setReviewing(false);
                      setI(vis(answers).findIndex((x) => x.id === s.id));
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary-soft"
                  >
                    <IconBadge icon={s.icon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-muted">{s.question[lang]}</span>
                      <span className={`block text-lg font-semibold ${v === undefined ? "text-muted" : ""}`}>{display}</span>
                    </span>
                    <span className="text-sm font-semibold text-primary">{lang === "hi" ? "बदलें" : "Edit"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="rounded-md border border-bad/30 bg-bad-soft p-3 text-bad">{error}</p>}
          </div>
          </div>
        </main>
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-4">
          <button onClick={submit} disabled={busy} className="mx-auto flex h-14 w-full max-w-3xl items-center justify-center gap-2 rounded-md bg-good text-lg font-bold text-white shadow-sm disabled:opacity-60">
            {busy ? MSG.saving[lang] : `✅ ${submitLabel[lang]}`}
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;
  const progress = Math.round(((i + 1) / steps.length) * 100);
  const canSkip = step.kind === "choice" && !["relation", "gender"].includes(step.id);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppHeader back={goBack} title={title} compact />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          {/* Form header: step count, section and progress */}
          <div className="border-b border-line bg-surface-2 px-5 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-primary">{sectionOf(step)[lang]}</span>
              <span className="text-muted">
                {lang === "hi" ? "चरण" : "Step"} {Math.min(i + 1, steps.length)} / {steps.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-good transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="h-3" />
          </div>

          <div className="p-5">
            <div className="mb-5 flex items-start gap-4">
              <IconBadge icon={step.icon} size="lg" />
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="text-2xl font-bold leading-snug">{step.question[lang]}</h2>
                {step.hint && <p className="mt-1 text-muted">{step.hint[lang]}</p>}
              </div>
              <button
                onClick={() => say(step.question[lang])}
                className="flex h-11 shrink-0 items-center gap-1 rounded-md border border-line px-3 text-sm"
                aria-label={lang === "hi" ? "फिर से सुनें" : "Hear again"}
              >
                🔊 <span className="hidden sm:inline">{lang === "hi" ? "सुनें" : "Listen"}</span>
              </button>
            </div>

            <StepInput key={step.id} step={step} value={answers[step.id]} onAnswer={answer} lang={lang} say={say} />

            {error && <p role="alert" className="mt-4 rounded-md border border-bad/30 bg-bad-soft p-3 text-lg text-bad">{error}</p>}
            {micError && !listening && <p role="alert" className="mt-4 rounded-md border border-bad/30 bg-bad-soft p-3 text-bad">🎤 {speechErrorText(micError, lang)}</p>}
            {listening && <p className="mt-4 rounded-md border-2 border-dashed border-saffron bg-accent-soft p-3 text-lg">{interim || MSG.listening[lang]}</p>}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={goBack} className="h-12 rounded-md border border-line bg-surface px-5 font-semibold">← {MSG.back[lang]}</button>
          {canSkip && (
            <button onClick={skip} className="h-12 flex-1 rounded-md px-3 text-muted underline">{MSG.skip[lang]}</button>
          )}
          {!canSkip && <span className="flex-1" />}
          {supported && step.kind !== "pin" && step.kind !== "consent" && (
            <button
              onClick={() => (listening ? stop() : start())}
              className={`flex h-14 items-center gap-2 rounded-full px-5 text-lg font-bold text-white shadow-md ${listening ? "mic-live bg-accent" : "bg-primary"}`}
              aria-label={MSG.speak[lang]}
            >
              {listening ? "■" : "🎤"} <span className="text-base">{listening ? MSG.listening[lang] : MSG.speak[lang]}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Inputs ---------- */

function StepInput({
  step,
  value,
  onAnswer,
  lang,
  say,
}: {
  step: Step;
  value: unknown;
  onAnswer: (v: unknown) => void;
  lang: "en" | "hi";
  say: (t: string) => void;
}) {
  switch (step.kind) {
    case "choice":
      if (step.options!.length > 20) return <LongChoice step={step} value={value} onAnswer={onAnswer} lang={lang} />;
      return (
        <div className={`grid gap-3 ${step.options!.length > 6 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          {step.options!.map((o) => {
            const selected = value === o.value;
            return (
              <button
                key={String(o.value)}
                onClick={() => onAnswer(o.value)}
                aria-pressed={selected}
                className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 text-center transition active:scale-[0.98] ${
                  selected ? "border-primary bg-primary-soft shadow-sm" : "border-line bg-surface hover:border-primary/60 hover:bg-bg"
                }`}
              >
                <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${selected ? "border-primary bg-primary text-white" : "border-line"}`} aria-hidden>
                  {selected ? "✓" : ""}
                </span>
                <span className="text-4xl" aria-hidden>{o.icon}</span>
                <span className="text-base font-semibold leading-tight">{o.label[lang]}</span>
              </button>
            );
          })}
        </div>
      );
    case "number":
      return <Keypad initial={value === undefined ? "" : String(value)} maxLen={3} onDone={(s) => s && onAnswer(Number(s))} big suffix={lang === "hi" ? "साल" : "years"} />;
    case "mobile":
      return <MobileInput initial={(value as string) ?? ""} onDone={onAnswer} lang={lang} say={say} />;
    case "pin":
      return <PinInput onDone={onAnswer} lang={lang} say={say} />;
    case "text":
    case "code":
      return <TextInput initial={(value as string) ?? ""} upper={step.kind === "code"} onDone={onAnswer} lang={lang} />;
    case "consent":
      return <Consent onAnswer={onAnswer} lang={lang} say={say} />;
  }
}

/** Long lists (e.g. 55 districts): type-to-filter plus compact buttons. */
function LongChoice({ step, value, onAnswer, lang }: { step: Step; value: unknown; onAnswer: (v: unknown) => void; lang: "en" | "hi" }) {
  const [f, setF] = useState("");
  const q = f.trim().toLowerCase();
  const shown = step.options!.filter((o) => !q || o.label.hi.includes(f.trim()) || o.label.en.toLowerCase().includes(q));
  return (
    <div>
      <input
        value={f}
        onChange={(e) => setF(e.target.value)}
        placeholder={lang === "hi" ? "🔍 नाम लिखकर खोजें…" : "🔍 Type to search…"}
        className="mb-3 h-12 w-full rounded-md border-2 border-line bg-bg px-3 text-lg outline-none focus:border-primary"
      />
      <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {shown.map((o) => (
          <button
            key={String(o.value)}
            onClick={() => onAnswer(o.value)}
            aria-pressed={value === o.value}
            className={`min-h-12 rounded-md border-2 px-3 py-2 text-left font-semibold ${value === o.value ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/60"}`}
          >
            {o.label[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}

const DEVANAGARI = "०१२३४५६७८९";

/**
 * Big on-screen number pad that ALSO accepts the physical keyboard (digits, Hindi digits,
 * Backspace, Enter) and paste — phone users tap, laptop users type.
 * With `auto`, fixed-length codes (OTP, PIN, mobile, Samagra ID) submit as soon as they are complete.
 */
export function Keypad({
  initial,
  maxLen,
  onDone,
  big,
  suffix,
  mask,
  auto,
}: {
  initial: string;
  maxLen: number;
  onDone: (s: string) => void;
  big?: boolean;
  suffix?: string;
  mask?: boolean;
  auto?: boolean;
}) {
  const [v, setV] = useState(initial);
  const vRef = useRef(v);
  vRef.current = v;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const { lang } = usePrefs();

  const press = useCallback((d: string) => setV((x) => (x.length < maxLen ? x + d : x)), [maxLen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = /^[0-9]$/.test(e.key) ? e.key : DEVANAGARI.includes(e.key) && e.key ? String(DEVANAGARI.indexOf(e.key)) : null;
      if (digit !== null) {
        e.preventDefault();
        press(digit);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setV((x) => x.slice(0, -1));
      } else if (e.key === "Enter" && vRef.current) {
        e.preventDefault();
        doneRef.current(vRef.current);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const digits = (e.clipboardData?.getData("text") ?? "").replace(/[०-९]/g, (d) => String(DEVANAGARI.indexOf(d))).replace(/\D/g, "");
      if (digits) setV(digits.slice(0, maxLen));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [maxLen, press]);

  // Fixed-length codes submit themselves once complete.
  useEffect(() => {
    if (auto && v.length === maxLen) {
      const id = setTimeout(() => doneRef.current(v), 250);
      return () => clearTimeout(id);
    }
  }, [auto, v, maxLen]);

  const shown = mask ? "●".repeat(v.length) + "○".repeat(maxLen - v.length) : v || "—";
  return (
    <div className="mx-auto w-full max-w-sm">
      <p className={`mb-2 rounded-md border-2 border-line bg-bg py-4 text-center font-bold tracking-widest ${big ? "text-5xl" : "text-3xl"}`} aria-live="polite">
        {shown} {suffix && v && <span className="text-xl font-normal text-muted">{suffix}</span>}
      </p>
      <p className="mb-3 hidden text-center text-xs text-muted md:block">⌨️ {lang === "hi" ? "कीबोर्ड से भी टाइप कर सकते हैं" : "You can also type on the keyboard"}</p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-16 rounded-md border border-line bg-surface text-3xl font-semibold shadow-sm hover:bg-bg active:bg-surface-2">{d}</button>
        ))}
        <button type="button" onClick={() => setV((x) => x.slice(0, -1))} className="h-16 rounded-md border border-line bg-surface-2 text-2xl" aria-label="Delete">⌫</button>
        <button type="button" onClick={() => press("0")} className="h-16 rounded-md border border-line bg-surface text-3xl font-semibold shadow-sm hover:bg-bg">0</button>
        <button type="button" onClick={() => onDone(v)} disabled={!v} className="h-16 rounded-md bg-good text-3xl text-white disabled:opacity-40" aria-label="OK">✓</button>
      </div>
    </div>
  );
}

function MobileInput({ initial, onDone, lang, say }: { initial: string; onDone: (v: string) => void; lang: "en" | "hi"; say: (t: string) => void }) {
  const [err, setErr] = useState(false);
  return (
    <>
      <Keypad
        initial={initial}
        maxLen={10}
        auto
        onDone={(s) => {
          if (/^[6-9]\d{9}$/.test(s)) onDone(s);
          else {
            setErr(true);
            say(MSG.badMobile[lang]);
          }
        }}
      />
      {err && <p className="mt-3 text-center text-bad">{MSG.badMobile[lang]}</p>}
    </>
  );
}

function PinInput({ onDone, lang, say }: { onDone: (v: string) => void; lang: "en" | "hi"; say: (t: string) => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [err, setErr] = useState(false);
  return (
    <>
      {first && <p className="mb-3 text-center text-lg font-semibold">{MSG.pinAgain[lang]}</p>}
      {err && <p className="mb-3 text-center text-bad">{MSG.pinMismatch[lang]}</p>}
      <Keypad
        key={round}
        initial=""
        maxLen={4}
        mask
        auto
        onDone={(s) => {
          if (s.length !== 4) return;
          if (!first) {
            setFirst(s);
            setErr(false);
            setRound((r) => r + 1);
            say(MSG.pinAgain[lang]);
          } else if (s === first) onDone(s);
          else {
            setFirst(null);
            setErr(true);
            setRound((r) => r + 1);
            say(MSG.pinMismatch[lang]);
          }
        }}
      />
    </>
  );
}

function TextInput({ initial, upper, onDone, lang }: { initial: string; upper?: boolean; onDone: (v: string) => void; lang: "en" | "hi" }) {
  const [v, setV] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onDone(upper ? v.trim().toUpperCase() : v.trim());
      }}
      className="flex flex-col gap-3"
    >
      <input
        value={v}
        onChange={(e) => setV(upper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={MSG.typeHere[lang]}
        autoFocus
        className={`h-14 w-full rounded-md border-2 border-line bg-bg px-4 text-2xl outline-none focus:border-primary ${upper ? "text-center font-mono tracking-[0.3em]" : ""}`}
      />
      <button type="submit" disabled={!v.trim()} className="h-14 rounded-md bg-primary text-lg font-bold text-primary-ink disabled:opacity-40">
        {MSG.next[lang]} →
      </button>
    </form>
  );
}

function Consent({ onAnswer, lang, say }: { onAnswer: (v: boolean) => void; lang: "en" | "hi"; say: (t: string) => void }) {
  const [declined, setDeclined] = useState(false);
  return (
    <div className="space-y-3">
      <button onClick={() => onAnswer(true)} className="flex h-16 w-full items-center justify-center gap-3 rounded-md bg-good text-xl font-bold text-white">
        ✅ {MSG.consentYes[lang]}
      </button>
      <button
        onClick={() => {
          setDeclined(true);
          say(MSG.consentNeeded[lang]);
        }}
        className="flex h-14 w-full items-center justify-center rounded-md border border-line text-lg"
      >
        {MSG.consentNo[lang]}
      </button>
      {declined && (
        <p className="rounded-xl bg-warn-soft p-3">
          {MSG.consentNeeded[lang]}{" "}
          <a href="/chat" className="font-semibold text-primary underline">{lang === "hi" ? "बिना पंजीकरण जाँचें →" : "Check without registering →"}</a>
        </p>
      )}
    </div>
  );
}
