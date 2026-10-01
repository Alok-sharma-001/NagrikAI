"use client";

import { useEffect, useState } from "react";
import { CATEGORY_NAMES, t } from "@/lib/i18n";
import { downloadFile, remindersToIcs } from "@/lib/ics";
import { rupees } from "@/lib/labels";
import { QUESTIONS } from "@/lib/questions";
import { speak, stopSpeaking } from "@/lib/voice";
import type { Lang, MatchResponse, MatchResult, Profile } from "@/lib/types";

type Tab = "eligible" | "possible" | "checklist" | "reminders";

type Props = {
  lang: Lang;
  profile: Profile;
  match: MatchResponse | null;
  onAnswer: (patch: Partial<Profile>) => void;
};

export default function Results({ lang, profile, match, onAnswer }: Props) {
  const [tab, setTab] = useState<Tab>("eligible");

  if (!match || (!match.eligible.length && !match.possible.length)) {
    return (
      <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-4xl" aria-hidden>🏛️</p>
        <p className="mt-3 max-w-sm text-muted">{t("emptyResults", lang)}</p>
      </div>
    );
  }

  const { totals } = match;
  const tabs: [Tab, string, number][] = [
    ["eligible", t("eligible", lang), match.eligible.length],
    ["possible", t("possible", lang), match.possible.length],
    ["checklist", t("checklist", lang), match.checklist.length],
    ["reminders", t("reminders", lang), match.reminders.length],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-primary p-5 text-primary-ink shadow-sm">
        <p className="text-4xl font-bold">{match.eligible.length}</p>
        <p className="opacity-90">{t("schemesFor", lang)}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Stat value={rupees(totals.cashPerYear)} label={t("perYear", lang)} />
          <Stat value={rupees(totals.oneTime)} label={t("oneTime", lang)} />
          <Stat value={rupees(totals.cover)} label={t("cover", lang)} />
        </div>
      </div>

      <div className="no-print grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 sm:flex" role="tablist">
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${tab === id ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {label} <span className="ml-1 rounded-full bg-bg px-1.5 text-xs">{count}</span>
          </button>
        ))}
      </div>

      {tab === "eligible" && (
        <div className="space-y-3">
          {match.eligible.map((r) => <SchemeCard key={r.scheme.id} r={r} lang={lang} profile={profile} onAnswer={onAnswer} />)}
          {match.ineligible.length > 0 && <IneligibleList items={match.ineligible} lang={lang} />}
        </div>
      )}
      {tab === "possible" && (
        <div className="space-y-3">
          {match.possible.map((r) => <SchemeCard key={r.scheme.id} r={r} lang={lang} profile={profile} onAnswer={onAnswer} />)}
        </div>
      )}
      {tab === "checklist" && <Checklist match={match} lang={lang} />}
      {tab === "reminders" && <Reminders match={match} lang={lang} />}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-2.5">
      <p className="text-base font-semibold sm:text-lg">{value}</p>
      <p className="text-xs opacity-85">{label}</p>
    </div>
  );
}

function SchemeCard({ r, lang, profile, onAnswer }: { r: MatchResult; lang: Lang; profile: Profile; onAnswer: Props["onAnswer"] }) {
  const s = r.scheme;
  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const cat = CATEGORY_NAMES[s.category];
  const unknownFields = [...new Set(r.unknown.map((u) => u.field))].filter((f) => QUESTIONS[f]);

  // Profile or language change makes an old explanation stale.
  useEffect(() => setExplain(null), [lang, profile]);

  const why = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemeId: s.id, profile, lang }),
      });
      const data = await res.json();
      setExplain(data.text);
      setSpeaking(true);
      speak(data.text, lang, () => setSpeaking(false));
    } catch {
      setExplain(t("explainError", lang));
    } finally {
      setLoading(false);
    }
  };

  const listen = () => {
    if (speaking) {
      stopSpeaking();
      return setSpeaking(false);
    }
    setSpeaking(true);
    speak(explain ?? `${s.name[lang]}. ${s.summary[lang]} ${s.benefit[lang]}.`, lang, () => setSpeaking(false));
  };

  const border = r.verdict === "eligible" ? "border-l-good" : "border-l-warn";

  return (
    <article className={`rounded-lg border border-l-4 border-line ${border} bg-surface p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl" aria-hidden>{cat.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{cat[lang]} · {s.ministry}</p>
          <h3 className="font-semibold leading-snug">{s.name[lang]}</h3>
          <p className="mt-1 text-sm font-medium text-good">{s.benefit[lang]}</p>
        </div>
      </div>

      {r.verdict === "eligible" && r.matched.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("whyQualify", lang)}>
          {r.matched.map((m, i) => (
            <li key={i} className="rounded-md bg-good-soft px-2 py-0.5 text-xs text-good">✓ {m.label[lang]}</li>
          ))}
        </ul>
      )}

      {r.verdict === "possible" && unknownFields.length > 0 && (
        <div className="mt-3 space-y-2 rounded-xl bg-warn-soft p-3">
          <p className="text-xs font-semibold text-warn">{t("needToKnow", lang)}</p>
          {unknownFields.map((f) => {
            const q = QUESTIONS[f]!;
            return (
              <div key={f}>
                <p className="text-sm">{q.question[lang]}</p>
                {q.options.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {q.options.map((o) => (
                      <button
                        key={String(o.value)}
                        onClick={() => onAnswer({ [f]: o.value } as Partial<Profile>)}
                        className="min-h-9 rounded-full border border-line bg-surface px-3 text-sm hover:border-primary"
                      >
                        {o.label[lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="no-print mt-3 flex flex-wrap gap-2">
        <button onClick={why} className="min-h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink">
          {loading ? "…" : t("why", lang)}
        </button>
        <button onClick={listen} className="min-h-10 rounded-full border border-line px-4 text-sm">
          {speaking ? `⏹ ${t("stop", lang)}` : `🔊 ${t("listen", lang)}`}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="min-h-10 rounded-full border border-line px-4 text-sm" aria-expanded={open}>
          {t("apply", lang)} {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
          {explain && <p className="rounded-xl bg-primary-soft p-3 leading-relaxed">{explain}</p>}
          <p className="leading-relaxed">{s.howToApply[lang]}</p>
          {s.alsoRequired && (
            <div>
              <p className="font-semibold">{t("alsoRequired", lang)}</p>
              <ul className="ml-5 list-disc text-muted">{s.alsoRequired.map((a, i) => <li key={i}>{a[lang]}</li>)}</ul>
            </div>
          )}
          {s.stateNote && (
            <p className="rounded-lg bg-accent-soft p-2.5"><strong>{t("stateNote", lang)}:</strong> {s.stateNote[lang]}</p>
          )}
          <p className="text-muted">🗓️ {s.deadline.note[lang]}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a href={s.applyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">{t("officialSite", lang)} ↗</a>
            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted underline">{t("source", lang)}</a>
          </div>
          <p>
            📞 {t("helpline", lang)}:{" "}
            {s.helpline ? <a href={`tel:${s.helpline.replace(/-/g, "")}`} className="font-medium text-primary underline">{s.helpline}</a> : <span className="text-muted">{t("noHelpline", lang)}</span>}
          </p>
        </div>
      )}
    </article>
  );
}

function IneligibleList({ items, lang }: { items: MatchResult[]; lang: Lang }) {
  // State alternatives first (e.g. a state widow pension), then near misses.
  const sorted = [...items].sort(
    (a, b) => Number(!!b.scheme.stateAlternative) - Number(!!a.scheme.stateAlternative) || a.failed.length - b.failed.length,
  );
  return (
    <details className="rounded-lg border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-muted">
        {t("notEligibleList", lang)} ({items.length})
      </summary>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((r) => (
          <li key={r.scheme.id} className="text-sm">
            <p className="font-medium">{r.scheme.name[lang]}</p>
            <p className="text-bad">✗ {t("notEligibleBecause", lang)}: {r.failed.map((f) => f.label[lang]).join("; ")}</p>
            {r.scheme.stateAlternative && r.scheme.stateNote && <p className="mt-1 rounded-lg bg-accent-soft p-2">💡 {r.scheme.stateNote[lang]}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function useChecked() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem("nagrik.checked") ?? "{}"));
    } catch {}
  }, []);
  const toggle = (id: string) =>
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem("nagrik.checked", JSON.stringify(next));
      } catch {}
      return next;
    });
  return { checked, toggle };
}

function Checklist({ match, lang }: { match: MatchResponse; lang: Lang }) {
  const { checked, toggle } = useChecked();
  const names = new Map(match.eligible.map((r) => [r.scheme.id, r.scheme.name[lang]]));
  const done = match.checklist.filter((c) => checked[c.doc.id]).length;
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {done}/{match.checklist.length} {lang === "hi" ? "तैयार" : "ready"}
        </p>
        <button onClick={() => window.print()} className="no-print rounded-full border border-line px-3 py-1.5 text-sm">🖨️ {t("print", lang)}</button>
      </div>
      <ul className="divide-y divide-line">
        {match.checklist.map(({ doc, neededFor }) => (
          <li key={doc.id} className="flex gap-3 py-3">
            <input
              id={`doc-${doc.id}`}
              type="checkbox"
              checked={!!checked[doc.id]}
              onChange={() => toggle(doc.id)}
              className="mt-1 h-6 w-6 shrink-0 accent-[var(--good)]"
            />
            <label htmlFor={`doc-${doc.id}`} className="min-w-0 flex-1">
              <p className={`font-medium ${checked[doc.id] ? "text-muted line-through" : ""}`}>{doc.name[lang]}</p>
              <p className="text-sm text-muted">📍 {t("whereToGet", lang)}: {doc.where[lang]}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t("neededFor", lang)} ({neededFor.length}): {neededFor.map((id) => names.get(id)).filter(Boolean).join(", ")}
              </p>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reminders({ match, lang }: { match: MatchResponse; lang: Lang }) {
  const names = new Map([...match.eligible, ...match.possible].map((r) => [r.scheme.id, r.verdict]));
  const dated = match.reminders.filter((r) => r.date);
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      {dated.length > 0 && (
        <button
          onClick={() => downloadFile("nagrikai-reminders.ics", remindersToIcs(match.reminders, lang), "text/calendar")}
          className="no-print mb-3 min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink"
        >
          📅 {t("addToCalendar", lang)}
        </button>
      )}
      <ul className="divide-y divide-line">
        {match.reminders.map((r) => (
          <li key={r.schemeId} className="flex gap-3 py-3">
            <div className={`w-24 shrink-0 text-sm font-semibold ${r.date ? "text-accent" : "text-muted"}`}>
              {r.date ? fmt(r.date) : "—"}
            </div>
            <div className="min-w-0">
              <p className="font-medium">
                {r.title[lang]}
                {names.get(r.schemeId) === "possible" && <span className="ml-2 rounded bg-warn-soft px-1.5 text-xs text-warn">{t("possible", lang)}</span>}
              </p>
              <p className="text-sm text-muted">{r.date ? r.note[lang] : `${t("noDate", lang)} — ${r.note[lang]}`}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
