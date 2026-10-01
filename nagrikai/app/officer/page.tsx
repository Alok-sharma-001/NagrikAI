"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { Keypad } from "@/components/Wizard";
import { api, Panel, usePrefs } from "@/components/ui";
import { rupees } from "@/lib/labels";
import type { OfficerSummary } from "@/lib/officer";

type Summary = OfficerSummary & { feedback: { scheme_id: string; district: string | null; note: string; created_at: string }[] };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/**
 * Officer view: the saturation gap. For every scheme and district — how many eligible,
 * how many receiving, how many left out — computed by the same rules engine citizens see.
 */
export default function OfficerPage() {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const [auth, setAuth] = useState<{ loggedIn: boolean; demoCode: boolean } | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: string) => {
    try {
      setData(await api<Summary>(`/api/officer/summary${d ? `?district=${encodeURIComponent(d)}` : ""}`));
    } catch {
      setAuth((a) => (a ? { ...a, loggedIn: false } : a));
    }
  }, []);

  useEffect(() => {
    api<{ loggedIn: boolean; demoCode: boolean }>("/api/officer/login").then((a) => {
      setAuth(a);
      if (a.loggedIn) load("");
    });
  }, [load]);

  const login = async (code: string) => {
    setError(null);
    try {
      await api("/api/officer/login", "POST", { code });
      setAuth((a) => ({ demoCode: a?.demoCode ?? false, loggedIn: true }));
      load("");
    } catch {
      setError(hi ? "कोड गलत है।" : "Wrong access code.");
      setRound((r) => r + 1);
    }
  };

  const seed = async (action: "seed" | "clear") => {
    setBusy(true);
    await api("/api/officer/seed", "POST", { action }).catch(() => {});
    await load(district);
    setBusy(false);
  };

  if (!auth) return null;

  if (!auth.loggedIn) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader title={hi ? "अधिकारी लॉगिन" : "Officer login"} back="/" compact />
        <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-8">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <div className="border-b border-line bg-navy px-5 py-3 text-white">
              <p className="text-sm opacity-80">{hi ? "विभागीय उपयोग के लिए" : "For departmental use"}</p>
              <p className="text-lg font-bold">{hi ? "अधिकारी डैशबोर्ड" : "Officer dashboard"}</p>
            </div>
            <div className="p-5">
              <p className="mb-4 font-semibold">{hi ? "6 अंकों का एक्सेस कोड डालें" : "Enter the 6-digit access code"}</p>
              {auth.demoCode && (
                <p className="mb-4 rounded-md border border-dashed border-saffron bg-accent-soft p-3 text-sm">
                  🧪 {hi ? "डेमो मोड: कोई कोड सेट नहीं है। डेमो कोड:" : "Demo mode: no code is configured. Demo code:"}{" "}
                  <span className="font-mono font-bold tracking-widest">181181</span>
                </p>
              )}
              {error && <p role="alert" className="mb-3 rounded-md bg-bad-soft p-3 text-center text-bad">{error}</p>}
              <Keypad key={round} initial="" maxLen={6} mask auto onDone={login} />
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!data) return <div className="flex min-h-dvh items-center justify-center text-muted">…</div>;
  const t = data.totals;
  const maxGap = Math.max(1, ...data.schemes.map((s) => s.eligible));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader title={hi ? "अधिकारी डैशबोर्ड — संतृप्ति अंतर" : "Officer dashboard — saturation gap"} compact />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="district" className="block text-sm font-semibold text-muted">{hi ? "ज़िला" : "District"}</label>
            <select
              id="district"
              value={district}
              onChange={(e) => { setDistrict(e.target.value); load(e.target.value); }}
              className="mt-1 h-11 min-w-48 rounded-md border border-line bg-surface px-3"
            >
              <option value="">{hi ? "पूरा मध्यप्रदेश" : "All Madhya Pradesh"}</option>
              {data.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <span className="flex-1" />
          <a href={`/api/officer/export${district ? `?district=${encodeURIComponent(district)}` : ""}`} className="flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink">
            ⬇️ {hi ? "छूटे हुए लाभ — CSV" : "Unclaimed benefits — CSV"}
          </a>
          <button onClick={async () => { await api("/api/officer/logout", "POST"); setAuth({ ...auth, loggedIn: false }); }} className="h-11 rounded-md border border-line bg-surface px-4 text-sm">
            {hi ? "लॉगआउट" : "Log out"}
          </button>
        </div>

        {/* Demo data notice */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-saffron bg-accent-soft p-4 text-sm">
          <p className="min-w-0 flex-1">
            🧪 {t.demoFamilies > 0
              ? hi ? `इन आँकड़ों में ${t.demoFamilies} काल्पनिक (डेमो) परिवार शामिल हैं — असली नागरिक नहीं।` : `These figures include ${t.demoFamilies} fictional (demo) families — not real citizens.`
              : hi ? "अभी केवल असली पंजीकृत परिवार दिख रहे हैं। डैशबोर्ड दिखाने के लिए डेमो डेटा भर सकते हैं।" : "Only real registered families are shown. Load demo data to demonstrate the dashboard."}
          </p>
          <button disabled={busy} onClick={() => seed("seed")} className="h-10 rounded-md bg-navy px-4 font-semibold text-white disabled:opacity-50">{hi ? "240 डेमो परिवार भरें" : "Load 240 demo families"}</button>
          {t.demoFamilies > 0 && <button disabled={busy} onClick={() => seed("clear")} className="h-10 rounded-md border border-line bg-surface px-4 disabled:opacity-50">{hi ? "डेमो डेटा हटाएँ" : "Remove demo data"}</button>}
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile value={t.families.toLocaleString("en-IN")} label={hi ? "पंजीकृत परिवार" : "Families registered"} sub={`${t.members.toLocaleString("en-IN")} ${hi ? "सदस्य" : "members"}`} />
          <Tile value={t.eligible.toLocaleString("en-IN")} label={hi ? "पात्र लाभ" : "Eligible benefits"} sub={hi ? "नियमों के अनुसार" : "by the rules"} />
          <Tile value={t.receiving.toLocaleString("en-IN")} label={hi ? "मिल रहे हैं" : "Being received"} sub={`${pct(t.receiving, t.eligible)}% ${hi ? "संतृप्ति" : "saturation"}`} tone="good" />
          <Tile value={t.gap.toLocaleString("en-IN")} label={hi ? "छूटे हुए लाभ" : "Left out"} sub={`${t.applied.toLocaleString("en-IN")} ${hi ? "ने आवेदन किया है" : "have applied"}`} tone="bad" />
          <Tile value={rupees(t.unclaimedPerYear)} label={hi ? "अप्राप्त राशि / वर्ष" : "Unclaimed per year"} sub={hi ? "केवल नकद योजनाएँ" : "cash schemes only"} tone="bad" />
        </div>

        <Panel title={hi ? "योजना-वार: पात्र बनाम मिल रही" : "By scheme: eligible vs receiving"} icon="📊">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2 pr-3 font-semibold">{hi ? "योजना" : "Scheme"}</th>
                  <th className="px-2 py-2 text-right font-semibold">{hi ? "पात्र" : "Eligible"}</th>
                  <th className="px-2 py-2 text-right font-semibold">{hi ? "मिल रही" : "Receiving"}</th>
                  <th className="px-2 py-2 text-right font-semibold">{hi ? "छूटे" : "Left out"}</th>
                  <th className="w-[28%] px-2 py-2 font-semibold">{hi ? "संतृप्ति" : "Saturation"}</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.schemes.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{s.name[lang]}</span>
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${s.scope === "mp" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>{s.scope === "mp" ? (hi ? "म.प्र." : "MP") : hi ? "केंद्र" : "Central"}</span>
                      {s.intakeClosed && <span className="ml-1 rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">{hi ? "पंजीयन बंद" : "intake closed"}</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.eligible}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-good">{s.receiving}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums text-bad">{s.gap}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-bad-soft" style={{ maxWidth: `${Math.max(12, (s.eligible / maxGap) * 100)}%` }} title={`${s.receiving} / ${s.eligible}`}>
                          <div className="h-full bg-good" style={{ width: `${pct(s.receiving, s.eligible)}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums">{pct(s.receiving, s.eligible)}%</span>
                      </div>
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <a href={`/api/officer/export?scheme=${s.id}${district ? `&district=${encodeURIComponent(district)}` : ""}`} className="text-xs font-semibold text-primary underline">{hi ? "सूची" : "List"}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            {hi ? "पट्टी की लंबाई = पात्र लाभों की संख्या; हरा = मिल रही, लाल = छूटे। “सूची” से उस योजना के छूटे परिवारों की CSV (बिना नाम) मिलती है।" : "Bar length = eligible benefits; green = receiving, red = left out. “List” downloads the left-out households for that scheme as CSV (no names)."}
          </p>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={hi ? "ज़िला-वार संतृप्ति" : "Saturation by district"} icon="🗺️">
            <ul className="space-y-2.5">
              {data.byDistrict.map((d) => (
                <li key={d.district}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{d.district} <span className="font-normal text-muted">· {d.families} {hi ? "परिवार" : "families"}</span></span>
                    <span className="tabular-nums">{pct(d.receiving, d.eligible)}% · <span className="text-bad">{d.gap} {hi ? "छूटे" : "left out"}</span></span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-bad-soft"><div className="h-full bg-good" style={{ width: `${pct(d.receiving, d.eligible)}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="space-y-5">
            <Panel title={hi ? "सबसे ज़्यादा लगने वाले दस्तावेज़ (छूटे लाभों में)" : "Documents most needed for the left-out benefits"} icon="📄">
              <ol className="space-y-1.5 text-sm">
                {data.topDocuments.map((d, i) => (
                  <li key={d.name.en} className="flex justify-between gap-3"><span>{i + 1}. {d.name[lang]}</span><span className="tabular-nums text-muted">{d.count}</span></li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">{hi ? "शिविर में इन दस्तावेज़ों के काउंटर लगाएँ।" : "Set up counters for these documents at the camp."}</p>
            </Panel>
            <Panel title={hi ? "नागरिकों ने गलत जानकारी बताई" : "Citizens reported wrong information"} icon="⚠️">
              {data.feedback.length === 0 ? (
                <p className="text-sm text-muted">{hi ? "अभी कोई रिपोर्ट नहीं।" : "No reports yet."}</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {data.feedback.map((f, i) => (
                    <li key={i} className="py-2"><span className="font-mono text-xs text-primary">{f.scheme_id}</span> {f.district && <span className="text-xs text-muted">· {f.district}</span>}<br />{f.note}</li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <p className="text-xs text-muted">
          🔒 {hi ? "यह पेज केवल कुल आँकड़े दिखाता है। निर्यात में नाम या मोबाइल नंबर नहीं होते — केवल परिवार संदर्भ, ज़िला, योजना, उम्र और लिंग। “मिल रही है” की स्थिति अभी नागरिक खुद बताते हैं; असली तैनाती में यह DBT डेटा से आएगी।" : "This page shows aggregates only. Exports carry no names or mobile numbers — only a family reference, district, scheme, age and gender. “Receiving” is self-reported by citizens today; in a real deployment it would come from DBT data."}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function Tile({ value, label, sub, tone }: { value: string; label: string; sub: string; tone?: "good" | "bad" }) {
  const bar = tone === "good" ? "border-l-good" : tone === "bad" ? "border-l-bad" : "border-l-primary";
  return (
    <div className={`rounded-lg border border-l-4 border-line ${bar} bg-surface p-4 shadow-sm`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}
