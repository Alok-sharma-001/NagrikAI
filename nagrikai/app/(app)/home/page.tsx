"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import AskSheet from "@/components/AskSheet";
import { memberIcon, useFamily, verdictFor } from "@/components/FamilyProvider";
import { api, IconBadge, Panel, SchemeTags, SpeakButton, StatusBadge, usePrefs } from "@/components/ui";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { CATEGORY_NAMES } from "@/lib/i18n";
import { downloadFile, remindersToIcs } from "@/lib/ics";
import { rupees } from "@/lib/labels";
import { familyAlerts } from "@/lib/alerts";
import { nextQuestion } from "@/lib/unlock";
import { StatusChip } from "@/components/StatusControl";
import type { Category } from "@/lib/types";

export default function HomePage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

const ORDER: Category[] = ["health", "food", "housing", "pension", "education", "women_child", "agriculture", "employment", "insurance", "financial_inclusion", "business", "skill", "disability", "energy", "sanitation"];

function Home() {
  const { data, refresh } = useFamily();
  const { lang } = usePrefs();
  const router = useRouter();
  const params = useSearchParams();
  const who = params.get("who") ?? "all";
  const view = params.get("view"); // a category, "all", "docs" or "reminders"
  const [asking, setAsking] = useState(false);
  const hi = lang === "hi";

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v === null) p.delete(k);
    else p.set(k, v);
    router.push(`/home?${p.toString()}`, { scroll: true });
  };

  const counts = useMemo(() => {
    const c = new Map<Category, { eligible: number; possible: number; total: number }>();
    for (const r of data?.match.schemes ?? []) {
      const e = c.get(r.scheme.category) ?? { eligible: 0, possible: 0, total: 0 };
      const v = verdictFor(r, who);
      e.total++;
      if (v === "eligible") e.eligible++;
      if (v === "possible") e.possible++;
      c.set(r.scheme.category, e);
    }
    return c;
  }, [data, who]);

  if (!data) return <div className="flex min-h-dvh items-center justify-center text-muted">…</div>;
  const { me, family, match, statuses } = data;
  // Of the schemes shown as "can get", how many are already being received (same unit as the big number).
  const mine = match.schemes.filter((r) => verdictFor(r, who) === "eligible");
  const receiving = mine.filter((r) =>
    r.level === "household"
      ? statuses[`${r.scheme.id}|`] === "receiving"
      : r.members.some((m) => (who === "all" || m.memberId === who) && statuses[`${r.scheme.id}|${m.memberId}`] === "receiving"),
  ).length;
  const alerts = me.status === "active" ? familyAlerts(family, match, statuses).filter((a) => who === "all" || !a.memberName || a.memberName === family.members.find((m) => m.id === who)?.name) : [];
  const self = family.members.find((m) => m.id === me.id)!;
  const selected = who === "all" ? null : family.members.find((m) => m.id === who);
  const eligibleCount = who === "all" ? match.totals.eligible : (match.perMember.find((p) => p.memberId === who)?.eligible ?? 0);
  const q = me.status === "active" ? nextQuestion(match, who) : null;
  const qMember = q?.memberId ? family.members.find((m) => m.id === q.memberId) : null;

  const summary = hi
    ? `${selected ? selected.name + " को" : "आपके परिवार को"} ${eligibleCount} योजनाओं का लाभ मिल सकता है।${who === "all" ? ` लगभग ${rupees(match.totals.cashPerYear)} सालाना, ${rupees(match.totals.oneTime)} तक एकमुश्त, और ${rupees(match.totals.cover)} तक का बीमा।` : ""}`
    : `${selected ? selected.name : "Your family"} can get ${eligibleCount} schemes.${who === "all" ? ` About ${rupees(match.totals.cashPerYear)} a year, up to ${rupees(match.totals.oneTime)} one-time, and up to ${rupees(match.totals.cover)} insurance cover.` : ""}`;

  const answerQuestion = async (value: unknown) => {
    if (!q) return;
    if (q.memberId === null) await api("/api/family/household", "PATCH", { household: { [q.field]: value } });
    else {
      const m = family.members.find((x) => x.id === q.memberId)!;
      await api(`/api/family/members/${m.id}`, "PATCH", { profile: { ...m.profile, [q.field]: value } });
    }
    await refresh();
  };

  /* ---------- A list view: one category, all schemes, documents or reminders ---------- */
  if (view) {
    const title =
      view === "docs" ? (hi ? "ज़रूरी दस्तावेज़" : "Documents needed")
      : view === "reminders" ? (hi ? "याद रखने की तारीखें" : "Dates to remember")
      : view === "all" ? (hi ? "सभी योजनाएँ" : "All schemes")
      : CATEGORY_NAMES[view as Category][lang];
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader back={() => setParam("view", null)} title={title} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
          <MemberTabs />
          {view === "docs" ? <Docs /> : view === "reminders" ? <Reminders /> : <SchemeList cat={view === "all" ? null : (view as Category)} />}
        </main>
        <SiteFooter />
        <AskFab onClick={() => setAsking(true)} />
        <AskSheet open={asking} onClose={() => setAsking(false)} memberId={who} />
      </div>
    );
  }

  /* ---------- Dashboard ---------- */
  const activeMembers = family.members.filter((m) => m.status === "active");
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Welcome bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-5 py-4 shadow-sm">
          <IconBadge icon={memberIcon(self)} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{hi ? "स्वागत है" : "Welcome"}</p>
            <p className="text-xl font-bold">{self.name} {hi ? "जी" : ""}</p>
          </div>
          {me.status === "active" && (family.samagraId || family.code) && (
            <div className="rounded-md border border-dashed border-primary/40 bg-primary-soft px-3 py-1.5 text-sm">
              {family.samagraId ? (hi ? "समग्र परिवार ID" : "Samagra family ID") : hi ? "परिवार कोड" : "Family code"}:{" "}
              <span className="font-mono font-bold tracking-widest text-primary">{family.samagraId ? `••••${family.samagraId.slice(-4)}` : family.code}</span>
            </div>
          )}
          <SpeakButton text={summary} className="h-10 rounded-md px-3 text-sm" label={hi ? "सुनें" : "Listen"} />
          <Link href="/family" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft">
            👨‍👩‍👧 {activeMembers.length} {hi ? "सदस्य" : "members"}
          </Link>
        </div>

        {me.status === "pending" && (
          <div className="mb-5 rounded-lg border-l-4 border-warn bg-warn-soft p-4 text-warn">
            ⏳ {hi ? "परिवार के मुखिया की मंज़ूरी का इंतज़ार है। तब तक आपकी अपनी योजनाएँ दिख रही हैं।" : "Waiting for the family head to approve you. Until then you see only your own schemes."}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi tone="primary" icon="✅" value={String(eligibleCount)} label={selected ? (hi ? `${selected.name} को मिल सकने वाली योजनाएँ` : `Schemes ${selected.name} can get`) : hi ? "परिवार को मिल सकने वाली योजनाएँ" : "Schemes your family can get"} note={mine.length ? (hi ? `${receiving} मिल रही हैं · ${mine.length - receiving} लेना बाकी` : `${receiving} receiving · ${mine.length - receiving} still to claim`) : undefined} />
          <Kpi tone="good" icon="💰" value={rupees(match.totals.cashPerYear)} label={hi ? "अनुमानित लाभ — हर साल" : "Estimated benefit — per year"} />
          <Kpi tone="saffron" icon="🏠" value={rupees(match.totals.oneTime)} label={hi ? "एकमुश्त सहायता (तक)" : "One-time support (up to)"} />
          <Kpi tone="navy" icon="🛡️" value={rupees(match.totals.cover)} label={hi ? "बीमा / स्वास्थ्य कवर (तक)" : "Insurance / health cover (up to)"} />
        </div>

        <div className="mt-5"><MemberTabs /></div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {q && (
              <section className="rounded-lg border border-warn/40 border-l-4 border-l-warn bg-warn-soft p-4">
                <p className="text-sm font-bold text-warn">
                  🔓 {hi ? `सूचना: ${match.totals.possible} और योजनाएँ खुल सकती हैं — बस इस सवाल का जवाब दें` : `Notice: ${match.totals.possible} more schemes may open up — just answer this`}
                </p>
                <p className="mt-2 text-lg font-bold">
                  {qMember ? `${qMember.name}: ` : ""}
                  {q.question[lang]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button key={String(o.value)} onClick={() => answerQuestion(o.value)} className="h-11 min-w-20 rounded-md border border-line bg-surface px-4 font-semibold shadow-sm hover:border-primary hover:text-primary">
                      {o.label[lang]}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {alerts.length > 0 && (
              <Panel title={hi ? "आपके परिवार के लिए ज़रूरी सूचनाएँ" : "Important for your family"} icon="🔔">
                <ul className="space-y-2">
                  {alerts.map((a) => {
                    const body = (
                      <>
                        <span className="text-2xl" aria-hidden>{a.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold leading-snug">
                            {a.urgent && <span className="mr-2 rounded bg-bad px-1.5 py-0.5 text-xs text-white">{hi ? "जल्दी करें" : "Act soon"}</span>}
                            {a.title[lang]}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted">{a.text[lang]}</span>
                        </span>
                        {a.schemeId && <span className="self-center text-sm font-semibold text-primary">{hi ? "देखें" : "View"} ›</span>}
                      </>
                    );
                    const cls = `flex gap-3 rounded-md border border-l-4 border-line p-3 ${a.urgent ? "border-l-bad bg-bad-soft/40" : "border-l-primary"}`;
                    return <li key={a.id}>{a.schemeId ? <Link href={`/scheme/${a.schemeId}`} className={cls + " hover:shadow-sm"}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
                  })}
                </ul>
              </Panel>
            )}

            <Panel title={hi ? "श्रेणी के अनुसार योजनाएँ" : "Schemes by category"} icon="📂" action={<button onClick={() => setParam("view", "all")} className="text-sm font-semibold text-primary hover:underline">{hi ? "सभी देखें →" : "View all →"}</button>}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ORDER.filter((c) => counts.get(c)).map((c) => {
                  const n = counts.get(c)!;
                  return (
                    <button
                      key={c}
                      onClick={() => setParam("view", c)}
                      className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 text-left transition hover:border-primary hover:shadow-sm"
                    >
                      <IconBadge icon={CATEGORY_NAMES[c].icon} size="sm" tone={n.eligible ? "green" : "grey"} />
                      <span className="min-w-0">
                        <span className="block font-semibold leading-tight">{CATEGORY_NAMES[c][lang]}</span>
                        <span className="text-xs">
                          {n.eligible > 0 && <span className="font-semibold text-good">✓ {n.eligible} </span>}
                          {n.possible > 0 && <span className="text-warn">? {n.possible} </span>}
                          {n.eligible + n.possible === 0 && <span className="text-muted">{n.total} {hi ? "योजनाएँ" : "schemes"}</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <aside className="space-y-5">
            <Panel title={hi ? "सवाल पूछें" : "Ask a question"} icon="🤖">
              <p className="text-sm text-muted">{hi ? "किसी भी योजना के बारे में बोलकर या लिखकर पूछें।" : "Ask about any scheme by voice or text."}</p>
              <button onClick={() => setAsking(true)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-ink">
                🎤 {hi ? "पूछें" : "Ask"}
              </button>
            </Panel>
            <Panel title={hi ? "त्वरित लिंक" : "Quick links"} icon="🔗">
              <ul className="divide-y divide-line">
                {[
                  ["📋", hi ? "सभी योजनाएँ" : "All schemes", () => setParam("view", "all"), match.schemes.length],
                  ["📄", hi ? "ज़रूरी दस्तावेज़" : "Documents needed", () => setParam("view", "docs"), match.checklist.length],
                  ["📅", hi ? "याद रखने की तारीखें" : "Dates to remember", () => setParam("view", "reminders"), match.reminders.filter((r) => r.date).length],
                  ["🖨️", hi ? "योजना पर्ची छापें" : "Print scheme slip", () => router.push("/slip"), null],
                  ["➕", hi ? "सदस्य जोड़ें" : "Add a member", () => router.push("/family/add"), null],
                ].map(([icon, label, go, n]) => (
                  <li key={label as string}>
                    <button onClick={go as () => void} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-primary">
                      <span aria-hidden>{icon as string}</span>
                      <span className="flex-1 font-medium">{label as string}</span>
                      {n !== null && <span className="rounded-full bg-surface-2 px-2 text-xs font-semibold">{n as number}</span>}
                      <span className="text-muted" aria-hidden>›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      </main>
      <SiteFooter />
      <AskFab onClick={() => setAsking(true)} />
      <AskSheet open={asking} onClose={() => setAsking(false)} memberId={who} />
    </div>
  );

  /* ---------- pieces that read the current page state ---------- */

  function MemberTabs() {
    if (activeCount() < 2) return null;
    const active = family.members.filter((m) => m.status === "active");
    const tab = (id: string, icon: string, label: string, n: number) => (
      <button
        key={id}
        onClick={() => setParam("who", id === "all" ? null : id)}
        aria-pressed={who === id}
        className={`flex h-11 shrink-0 items-center gap-2 border-b-4 px-4 text-sm font-semibold ${who === id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}
      >
        <span aria-hidden>{icon}</span> {label}
        <span className={`rounded-full px-2 text-xs ${who === id ? "bg-primary text-white" : "bg-surface-2"}`}>{n}</span>
      </button>
    );
    return (
      <div className="flex overflow-x-auto rounded-lg border border-line bg-surface px-1 shadow-sm" role="tablist">
        {tab("all", "👨‍👩‍👧", hi ? "पूरा परिवार" : "Whole family", match.totals.eligible)}
        {active.map((m) => tab(m.id, memberIcon(m), m.name, match.perMember.find((p) => p.memberId === m.id)?.eligible ?? 0))}
      </div>
    );
  }

  function activeCount() {
    return family.members.filter((m) => m.status === "active").length;
  }

  function SchemeList({ cat }: { cat: Category | null }) {
    const RANK = { eligible: 0, possible: 1, ineligible: 2 };
    const rows = match.schemes
      .filter((r) => !cat || r.scheme.category === cat)
      .map((r) => ({ r, v: verdictFor(r, who) }))
      .sort((a, b) => RANK[a.v] - RANK[b.v]);
    return (
      <ul className="space-y-3">
        {rows.map(({ r, v }) => {
          const forWhom = r.members.filter((m) => m.verdict === "eligible");
          const bar = v === "eligible" ? "border-l-good" : v === "possible" ? "border-l-warn" : "border-l-line";
          return (
            <li key={r.scheme.id}>
              <Link
                href={`/scheme/${r.scheme.id}${who !== "all" ? `?who=${who}` : ""}`}
                className={`flex gap-4 rounded-lg border border-l-4 border-line ${bar} bg-surface p-4 shadow-sm transition hover:shadow-md ${v === "ineligible" ? "opacity-75" : ""}`}
              >
                <IconBadge icon={CATEGORY_NAMES[r.scheme.category].icon} tone={v === "eligible" ? "green" : "grey"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge verdict={v} />
                    <SchemeTags scheme={r.scheme} />
                    <StatusChip status={r.level === "household" ? statuses[`${r.scheme.id}|`] : who !== "all" ? statuses[`${r.scheme.id}|${who}`] : r.members.map((m) => statuses[`${r.scheme.id}|${m.memberId}`]).find(Boolean)} />
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold leading-snug">{r.scheme.name[lang]}</h3>
                  <p className="mt-1 text-good">💰 {r.scheme.benefit[lang]}</p>
                  {who === "all" && v === "eligible" && (
                    <p className="mt-1.5 text-sm text-muted">
                      {r.level === "household" ? `🏠 ${hi ? "पूरे परिवार के लिए" : "For the whole family"}` : `👤 ${forWhom.map((m) => m.name).join(", ")}`}
                    </p>
                  )}
                </div>
                <span className="self-center text-sm font-semibold text-primary">{hi ? "विवरण" : "Details"} ›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  function Docs() {
    return (
      <Panel title={hi ? "इन कागज़ों को एक जगह तैयार रखें" : "Keep these papers ready in one place"} icon="📄">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">{hi ? "दस्तावेज़" : "Document"}</th>
                <th className="py-2 pr-3 font-semibold">{hi ? "कहाँ से बनवाएँ" : "Where to get it"}</th>
                <th className="py-2 font-semibold">{hi ? "किसके लिए" : "For"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {match.checklist.map((c) => (
                <tr key={c.doc.id} className="align-top">
                  <td className="py-3 pr-3 font-semibold">📄 {c.doc.name[lang]}</td>
                  <td className="py-3 pr-3 text-muted">{c.doc.where[lang]}</td>
                  <td className="py-3">
                    {c.members.join(", ")}
                    <span className="block text-xs text-muted">{c.neededFor.length} {hi ? "योजनाओं में ज़रूरी" : "schemes need it"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    );
  }

  function Reminders() {
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });
    const dated = match.reminders.filter((r) => r.date);
    return (
      <Panel
        title={hi ? "अंतिम तिथियाँ और नवीनीकरण" : "Last dates and renewals"}
        icon="📅"
        action={
          dated.length > 0 ? (
            <button onClick={() => downloadFile("nagrikai-reminders.ics", remindersToIcs(match.reminders, lang), "text/calendar")} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-ink">
              {hi ? "कैलेंडर में जोड़ें" : "Add to calendar"}
            </button>
          ) : null
        }
      >
        <ul className="divide-y divide-line">
          {match.reminders.map((r) => (
            <li key={r.schemeId} className="flex gap-4 py-3">
              <span className={`w-28 shrink-0 text-sm font-bold ${r.date ? "text-accent" : "text-muted"}`}>{r.date ? fmt(r.date) : hi ? "कभी भी" : "Any time"}</span>
              <span>
                <span className="block font-semibold">{r.title[lang]}</span>
                <span className="text-sm text-muted">{r.note[lang]}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }
}

function Kpi({ icon, value, label, tone, action, note }: { icon: string; value: string; label: string; tone: "primary" | "good" | "saffron" | "navy"; action?: React.ReactNode; note?: string }) {
  const bar = { primary: "border-l-primary", good: "border-l-good", saffron: "border-l-saffron", navy: "border-l-navy" }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-l-4 border-line ${bar} bg-surface p-4 shadow-sm`}>
      <span className="text-2xl" aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="mt-0.5 text-sm text-muted">{label}</p>
        {note && <p className="mt-1 text-xs font-semibold text-good">{note}</p>}
      </div>
      {action}
    </div>
  );
}

function AskFab({ onClick }: { onClick: () => void }) {
  const { lang } = usePrefs();
  return (
    <button
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-ink shadow-xl lg:hidden"
      aria-label={lang === "hi" ? "सवाल पूछें" : "Ask a question"}
    >
      🎤 {lang === "hi" ? "पूछें" : "Ask"}
    </button>
  );
}
