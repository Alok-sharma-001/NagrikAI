"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AskSheet from "@/components/AskSheet";
import StatusControl from "@/components/StatusControl";
import { memberIcon, useFamily, verdictFor } from "@/components/FamilyProvider";
import { api, IconBadge, Panel, SchemeTags, SpeakButton, StatusBadge, usePrefs, VERDICT_STYLE } from "@/components/ui";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { CATEGORY_NAMES } from "@/lib/i18n";
import { getDocument } from "@/lib/kb";

export default function SchemePage() {
  return (
    <Suspense>
      <SchemeDetail />
    </Suspense>
  );
}

function SchemeDetail() {
  const { id } = useParams<{ id: string }>();
  const who = useSearchParams().get("who") ?? "all";
  const { data } = useFamily();
  const { lang } = usePrefs();
  const [asking, setAsking] = useState(false);
  const hi = lang === "hi";

  if (!data) return <div className="flex min-h-dvh items-center justify-center text-5xl">🏛️</div>;
  const r = data.match.schemes.find((x) => x.scheme.id === id);
  if (!r) return <div className="p-8 text-center">{hi ? "योजना नहीं मिली" : "Scheme not found"}</div>;
  const s = r.scheme;
  const v = verdictFor(r, who);
  // For family-level schemes, list only who can apply (a daughter isn't "rejected" for her own savings scheme).
  const applicants = r.members.filter((m) => m.verdict !== "ineligible");
  const members =
    who !== "all" ? r.members.filter((m) => m.memberId === who) : r.level === "household" && applicants.length ? applicants : r.members;
  const eligibleNames = r.members.filter((m) => m.verdict === "eligible").map((m) => m.name);

  const spoken = [
    s.name[lang],
    s.summary[lang],
    (hi ? "लाभ: " : "Benefit: ") + s.benefit[lang],
    eligibleNames.length ? (hi ? `यह ${eligibleNames.join(", ")} को मिल सकती है।` : `${eligibleNames.join(", ")} can get this.`) : VERDICT_STYLE[v].label[lang],
    (hi ? "आवेदन कैसे करें: " : "How to apply: ") + s.howToApply[lang],
  ].join(". ");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader title={CATEGORY_NAMES[s.category][lang]} back={`/home?view=${s.category}${who !== "all" ? `&who=${who}` : ""}`} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Title block */}
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <IconBadge icon={CATEGORY_NAMES[s.category].icon} size="lg" tone={v === "eligible" ? "green" : "blue"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{CATEGORY_NAMES[s.category][lang]}</span>
                <StatusBadge verdict={v} />
                <SchemeTags scheme={s} />
              </div>
              <h1 className="mt-2 text-2xl font-bold leading-snug md:text-3xl">{s.name[lang]}</h1>
              <p className="mt-1 text-sm text-muted">{s.ministry}</p>
              <p className="mt-3 max-w-3xl text-lg">{s.summary[lang]}</p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Panel title={r.level === "household" ? (hi ? "परिवार में कौन आवेदन कर सकता है?" : "Who in the family can apply?") : hi ? "किसे मिलेगी और क्यों?" : "Who can get it, and why?"} icon="👥">
              <ul className="space-y-3">
                {members.map((m) => {
                  const member = data.family.members.find((x) => x.id === m.memberId)!;
                  return (
                    <li key={m.memberId} className="rounded-md border border-line p-3">
                      <div className="flex items-center gap-3">
                        <IconBadge icon={memberIcon(member)} size="sm" tone="grey" />
                        <span className="flex-1 text-lg font-semibold">{m.name}</span>
                        <StatusBadge verdict={m.verdict} />
                      </div>
                      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        {m.matched.map((x, i) => <li key={"m" + i} className="text-good">✓ {x.label[lang]}</li>)}
                        {m.failed.map((x, i) => <li key={"f" + i} className="text-bad">✗ {x.label[lang]}</li>)}
                        {m.unknown.map((x, i) => <li key={"u" + i} className="text-warn">? {x.label[lang]} — {hi ? "जानकारी नहीं दी" : "not told yet"}</li>)}
                      </ul>
                      {m.verdict !== "ineligible" && r.level !== "household" && <StatusControl schemeId={s.id} memberId={m.memberId} />}
                    </li>
                  );
                })}
              </ul>
              {r.level === "household" && v !== "ineligible" && <StatusControl schemeId={s.id} memberId="" />}
              {s.alsoRequired && (
                <div className="mt-3 rounded-md bg-surface-2 p-3 text-sm">
                  <p className="font-semibold">{hi ? "कार्यालय यह भी जाँचेगा:" : "The office will also check:"}</p>
                  <ul className="ml-5 list-disc">{s.alsoRequired.map((a, i) => <li key={i}>{a[lang]}</li>)}</ul>
                </div>
              )}
              {s.stateNote && (v !== "eligible" || !s.stateAlternative) && (
                <p className="mt-3 rounded-md border-l-4 border-saffron bg-accent-soft p-3 text-sm">💡 {s.stateNote[lang]}</p>
              )}
            </Panel>

            <Panel title={hi ? "आवेदन कैसे करें" : "How to apply"} icon="📝">
              <p className="text-lg leading-relaxed">{s.howToApply[lang]}</p>
              <p className="mt-3 rounded-md bg-surface-2 p-3 text-sm">🗓️ {s.deadline.note[lang]}</p>
            </Panel>

            <Panel title={hi ? "ज़रूरी दस्तावेज़" : "Documents needed"} icon="📄">
              <ol className="grid gap-2 sm:grid-cols-2">
                {s.documents.map((d, i) => {
                  const doc = getDocument(d);
                  return doc ? (
                    <li key={d} className="flex gap-3 rounded-md border border-line p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                      <span>
                        <span className="block font-semibold">{doc.name[lang]}</span>
                        <span className="text-sm text-muted">{doc.where[lang]}</span>
                      </span>
                    </li>
                  ) : null;
                })}
              </ol>
            </Panel>
          </div>

          <aside className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-good/40 bg-surface shadow-sm">
              <div className="bg-good px-4 py-2.5 font-bold text-white">💰 {hi ? "क्या मिलेगा" : "What you get"}</div>
              <div className="p-4">
                <p className="text-lg font-bold leading-snug">{s.benefit[lang]}</p>
                {r.level === "household" && <p className="mt-2 text-sm text-muted">🏠 {hi ? "यह पूरे परिवार को एक बार मिलता है" : "Given once to the whole family"}</p>}
              </div>
            </section>

            <Panel title={hi ? "आगे क्या करें" : "Next steps"} icon="➡️">
              <div className="space-y-2">
                <a href={s.applyUrl} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-ink">
                  🌐 {hi ? "आधिकारिक वेबसाइट पर जाएँ" : "Go to official website"}
                </a>
                {s.helpline ? (
                  <a href={`tel:${s.helpline.replace(/-/g, "")}`} className="flex h-12 items-center justify-center gap-2 rounded-md bg-good font-semibold text-white">
                    📞 {hi ? "हेल्पलाइन" : "Helpline"} {s.helpline}
                  </a>
                ) : (
                  <p className="rounded-md bg-surface-2 p-3 text-center text-sm">📍 {hi ? "नज़दीकी CSC / ग्राम पंचायत / नगर निगम कार्यालय जाएँ" : "Visit your nearest CSC / Gram Panchayat / municipal office"}</p>
                )}
                <button onClick={() => setAsking(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-primary font-semibold text-primary">
                  🤖 {hi ? "इस योजना के बारे में पूछें" : "Ask about this scheme"}
                </button>
                <SpeakButton text={spoken} className="h-12 w-full rounded-md" label={hi ? "पूरी जानकारी सुनें" : "Listen to details"} />
              </div>
            </Panel>

            <p className="text-xs text-muted">
              {hi ? "स्रोत" : "Source"}:{" "}
              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{new URL(s.sourceUrl).hostname}</a>
              {" · "}
              {s.reviewedOn ? (hi ? `जानकारी जाँची गई: ${s.reviewedOn}` : `Checked on ${s.reviewedOn}`) : hi ? "आधिकारिक स्रोत से जाँच बाकी" : "Not yet checked against the official source"}
              {" · "}
              {hi ? "अंतिम पात्रता सरकारी कार्यालय तय करता है।" : "Final eligibility is decided by the government office."}
            </p>
            <ReportWrong schemeId={s.id} />
          </aside>
        </div>
      </main>
      <SiteFooter />
      <AskSheet open={asking} onClose={() => setAsking(false)} schemeId={s.id} memberId={who} schemeName={s.name[lang]} />
    </div>
  );
}

/** "This information is wrong" — reaches the officer dashboard so the record gets rechecked. */
function ReportWrong({ schemeId }: { schemeId: string }) {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return <p className="rounded-md bg-good-soft p-3 text-sm text-good">✓ {hi ? "धन्यवाद! यह जानकारी दोबारा जाँची जाएगी।" : "Thank you! This will be rechecked."}</p>;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-muted underline">
        ⚠️ {hi ? "यह जानकारी गलत है? बताएँ" : "Is this information wrong? Tell us"}
      </button>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await api("/api/feedback", "POST", { schemeId, note }).catch(() => {});
        setSent(true);
      }}
      className="space-y-2 rounded-md border border-line bg-surface p-3"
    >
      <label htmlFor="wrong" className="text-sm font-semibold">{hi ? "क्या गलत है?" : "What is wrong?"}</label>
      <textarea id="wrong" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="w-full rounded-md border border-line bg-bg p-2 text-sm outline-none focus:border-primary" placeholder={hi ? "जैसे: राशि अब ₹… हो गई है" : "e.g. the amount is now ₹…"} />
      <button disabled={note.trim().length < 3} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink disabled:opacity-40">{hi ? "भेजें" : "Send"}</button>
    </form>
  );
}
