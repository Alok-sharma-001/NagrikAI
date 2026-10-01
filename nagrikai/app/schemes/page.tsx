"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { IconBadge, SchemeTags, StatusBadge, usePrefs } from "@/components/ui";
import type { FamilyMatch } from "@/lib/family";
import { CATEGORY_NAMES } from "@/lib/i18n";
import { getDocument, SCHEMES } from "@/lib/kb";
import { criteriaLabels } from "@/lib/labels";
import { searchSchemes } from "@/lib/search";
import type { Category, Scheme, Verdict } from "@/lib/types";

export default function SchemesPage() {
  return (
    <Suspense>
      <Catalogue />
    </Suspense>
  );
}

const ORDER: Category[] = ["health", "food", "housing", "pension", "education", "women_child", "agriculture", "employment", "insurance", "business", "skill", "disability", "financial_inclusion", "energy", "sanitation"];

function Catalogue() {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const router = useRouter();
  const params = useSearchParams();
  const cat = params.get("cat") as Category | null;
  const q = params.get("q") ?? "";
  const scope = params.get("scope"); // "mp" | "central" | null
  const [draft, setDraft] = useState(q);
  const [verdicts, setVerdicts] = useState<Map<string, Verdict> | null>(null);

  // Logged-in families also see their own status on every scheme.
  useEffect(() => {
    fetch("/api/family")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { match: FamilyMatch } | null) => d && setVerdicts(new Map(d.match.schemes.map((s) => [s.scheme.id, s.verdict]))))
      .catch(() => {});
  }, []);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.push(`/schemes?${p.toString()}`, { scroll: false });
  };

  const list = useMemo(() => {
    const base = q ? searchSchemes(q, 60) : SCHEMES;
    const rank = { eligible: 0, possible: 1, ineligible: 2 } as const;
    const filtered = base.filter((s) => (!cat || s.category === cat) && (!scope || (s.scope ?? "central") === scope));
    // Logged in: schemes the family can get come first.
    return verdicts ? [...filtered].sort((a, b) => rank[verdicts.get(a.id) ?? "ineligible"] - rank[verdicts.get(b.id) ?? "ineligible"]) : filtered;
  }, [q, cat, scope, verdicts]);

  const counts = useMemo(() => {
    const c = new Map<Category, number>();
    for (const s of SCHEMES) c.set(s.category, (c.get(s.category) ?? 0) + 1);
    return c;
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <div className="border-b border-line bg-primary-soft">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="section-title text-2xl font-bold">{hi ? "मध्यप्रदेश की सभी सरकारी योजनाएँ" : "All government schemes in Madhya Pradesh"}</h1>
          <p className="mt-3 text-muted">
            {hi ? `मध्यप्रदेश में लागू ${SCHEMES.length} योजनाएँ (राज्य + केंद्र) — हर योजना की शर्तें, लाभ, ज़रूरी कागज़ और आवेदन का तरीका।` : `${SCHEMES.length} schemes available in Madhya Pradesh (state + central) — conditions, benefits, documents and how to apply.`}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setParam("q", draft.trim() || null);
            }}
            className="mt-4 flex max-w-2xl gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={hi ? "योजना का नाम या ज़रूरत लिखें — जैसे पेंशन, इलाज, घर" : "Scheme name or need — e.g. pension, treatment, house"}
              className="h-12 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 outline-none focus:border-primary"
              aria-label={hi ? "योजना खोजें" : "Search schemes"}
            />
            <button className="h-12 rounded-md bg-primary px-5 font-semibold text-primary-ink">{hi ? "खोजें" : "Search"}</button>
          </form>
        </div>
      </div>

      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <aside aria-label={hi ? "श्रेणियाँ" : "Categories"}>
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{hi ? "श्रेणियाँ" : "Categories"}</p>
          <ul className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:gap-0.5 md:overflow-visible">
            <li>
              <button onClick={() => setParam("cat", null)} className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm ${!cat ? "bg-primary font-semibold text-primary-ink" : "hover:bg-surface-2"}`}>
                <span>📋 {hi ? "सभी" : "All"}</span> <span className="text-xs opacity-80">{SCHEMES.length}</span>
              </button>
            </li>
            {ORDER.filter((c) => counts.get(c)).map((c) => (
              <li key={c}>
                <button onClick={() => setParam("cat", c)} className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm ${cat === c ? "bg-primary font-semibold text-primary-ink" : "hover:bg-surface-2"}`}>
                  <span>{CATEGORY_NAMES[c].icon} {CATEGORY_NAMES[c][lang]}</span> <span className="text-xs opacity-80">{counts.get(c)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!verdicts && (
            <div className="mt-4 hidden rounded-lg border border-good/40 bg-good-soft p-4 text-sm md:block">
              <p className="font-semibold text-good">{hi ? "कौन सी योजना आपको मिलेगी?" : "Which of these can you get?"}</p>
              <p className="mt-1">{hi ? "परिवार का पंजीकरण करें — हम हर योजना के लिए आपकी पात्रता बताएँगे।" : "Register your family — we'll show your eligibility for each one."}</p>
              <Link href="/register" className="mt-3 inline-flex h-10 items-center rounded-md bg-good px-4 font-semibold text-white">{hi ? "पंजीकरण करें" : "Register"}</Link>
            </div>
          )}
        </aside>

        <section>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={hi ? "किसकी योजना" : "Run by"}>
            {([[null, hi ? "सभी" : "All"], ["mp", hi ? "मध्यप्रदेश शासन" : "Govt. of MP"], ["central", hi ? "भारत सरकार" : "Govt. of India"]] as const).map(([v, label]) => (
              <button
                key={label}
                onClick={() => setParam("scope", v)}
                aria-pressed={scope === v}
                className={`h-9 rounded-full border px-4 text-sm font-semibold ${scope === v ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface hover:border-primary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mb-3 text-sm text-muted">
            {list.length} {hi ? "योजनाएँ" : "schemes"}
            {q && <> · {hi ? "खोज" : "search"}: <strong>“{q}”</strong> <button onClick={() => { setDraft(""); setParam("q", null); }} className="text-primary underline">{hi ? "हटाएँ" : "clear"}</button></>}
          </p>
          <ul className="space-y-3">
            {list.map((s) => <SchemeRow key={s.id} s={s} verdict={verdicts?.get(s.id)} />)}
          </ul>
          {list.length === 0 && <p className="rounded-lg border border-line bg-surface p-6 text-center text-muted">{hi ? "कोई योजना नहीं मिली। दूसरे शब्द से खोजें।" : "No schemes found. Try another word."}</p>}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SchemeRow({ s, verdict }: { s: Scheme; verdict?: Verdict }) {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex gap-4 p-4">
        <IconBadge icon={CATEGORY_NAMES[s.category].icon} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{CATEGORY_NAMES[s.category][lang]}</span>
            {verdict && <StatusBadge verdict={verdict} />}
            <SchemeTags scheme={s} />
          </div>
          <h3 className="mt-1.5 text-lg font-bold leading-snug">{s.name[lang]}</h3>
          <p className="text-sm text-muted">{s.ministry}</p>
          <p className="mt-2">{s.summary[lang]}</p>
          <p className="mt-2 font-semibold text-good">💰 {s.benefit[lang]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {verdict ? (
              <Link href={`/scheme/${s.id}`} className="flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink">{hi ? "मेरी पात्रता देखें" : "See my eligibility"} →</Link>
            ) : (
              <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-10 items-center rounded-md border border-primary px-4 text-sm font-semibold text-primary">
                {open ? (hi ? "कम दिखाएँ ▴" : "Show less ▴") : hi ? "पूरी जानकारी ▾" : "Full details ▾"}
              </button>
            )}
            <a href={s.applyUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center rounded-md border border-line px-4 text-sm">🌐 {hi ? "आधिकारिक वेबसाइट" : "Official website"}</a>
          </div>
        </div>
      </div>
      {open && (
        <div className="grid gap-4 border-t border-line bg-bg p-4 text-sm md:grid-cols-2">
          <div>
            <p className="font-bold text-primary">{hi ? "कौन पात्र है" : "Who is eligible"}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {criteriaLabels(s.eligibility, lang).map((c) => <li key={c}>{c}</li>)}
              {s.alsoRequired?.map((a) => <li key={a.en}>{a[lang]}</li>)}
            </ul>
            {s.stateNote && <p className="mt-2 rounded bg-accent-soft p-2">💡 {s.stateNote[lang]}</p>}
          </div>
          <div>
            <p className="font-bold text-primary">{hi ? "ज़रूरी दस्तावेज़" : "Documents"}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">{s.documents.map((d) => <li key={d}>{getDocument(d)?.name[lang]}</li>)}</ul>
            <p className="mt-3 font-bold text-primary">{hi ? "आवेदन कैसे करें" : "How to apply"}</p>
            <p className="mt-1">{s.howToApply[lang]}</p>
            <p className="mt-2 text-muted">🗓️ {s.deadline.note[lang]}{s.helpline && <> · 📞 <a href={`tel:${s.helpline.replace(/-/g, "")}`} className="font-semibold text-primary">{s.helpline}</a></>}</p>
          </div>
          <p className="rounded-md bg-good-soft p-3 md:col-span-2">
            ✅ {hi ? "आप पात्र हैं या नहीं, यह जानने के लिए" : "To check if you're eligible,"}{" "}
            <Link href="/register" className="font-semibold text-good underline">{hi ? "परिवार का पंजीकरण करें" : "register your family"}</Link>{" "}
            {hi ? "या" : "or"} <Link href="/chat" className="font-semibold text-good underline">{hi ? "बिना पंजीकरण जाँचें" : "check without registering"}</Link>.
          </p>
        </div>
      )}
    </li>
  );
}
