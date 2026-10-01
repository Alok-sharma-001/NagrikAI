"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { AppHeader } from "@/components/Shell";
import { usePrefs } from "@/components/ui";
import { eligibleUnits, RELATION_NAMES } from "@/lib/family";

/** A one-page paper summary a citizen can carry to the Panchayat / CSC: schemes, who, documents, helplines. */
export default function SlipPage() {
  const { data } = useFamily();
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const [qr, setQr] = useState("");

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/login`, { margin: 1, width: 160 }).then(setQr).catch(() => {});
  }, []);

  if (!data) return null;
  const { family, match, statuses } = data;
  const active = family.members.filter((m) => m.status === "active");
  const head = active.find((m) => m.isHead) ?? active[0];
  const rows = match.schemes.filter((r) => r.verdict === "eligible");
  const units = eligibleUnits(match);
  const statusOf = (schemeId: string, level: string, memberIds: string[]) => {
    const keys = level === "household" ? [`${schemeId}|`] : memberIds.map((id) => `${schemeId}|${id}`);
    const st = keys.map((k) => statuses[k]).find(Boolean);
    return st === "receiving" ? (hi ? "मिल रही है" : "Receiving") : st === "applied" ? (hi ? "आवेदन किया" : "Applied") : st === "rejected" ? (hi ? "अस्वीकार" : "Rejected") : "☐";
  };
  const date = new Date().toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-dvh bg-bg print:bg-white">
      <AppHeader back="/home" title={hi ? "योजना पर्ची" : "Scheme slip"} />
      <div className="no-print mx-auto max-w-4xl px-4 pt-4">
        <button onClick={() => window.print()} className="h-12 rounded-md bg-primary px-6 font-bold text-primary-ink">🖨️ {hi ? "छापें / PDF सेव करें" : "Print / Save as PDF"}</button>
        <span className="ml-3 text-sm text-muted">{hi ? "इसे पंचायत, CSC या कार्यालय ले जाएँ" : "Carry this to the Panchayat, CSC or office"}</span>
      </div>

      <main id="main" className="mx-auto my-4 max-w-4xl bg-white p-6 text-[13px] leading-snug text-black shadow-sm print:m-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start gap-4 border-b-2 border-black pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-14 w-14" />
          <div className="flex-1">
            <p className="text-xl font-bold">{hi ? "नागरिक AI — योजना पर्ची" : "NagrikAI — Scheme Slip"}</p>
            <p>{hi ? "आपके परिवार को मिल सकने वाली सरकारी योजनाएँ" : "Government schemes your family may get"}</p>
            <p className="mt-1">
              <strong>{hi ? "परिवार" : "Family"}:</strong> {head?.name} · {family.household.district ?? ""}{family.household.district ? ", " : ""}{hi ? "मध्यप्रदेश" : "Madhya Pradesh"}
              {family.samagraId && <> · {hi ? "समग्र ID" : "Samagra ID"} ••••{family.samagraId.slice(-4)}</>} · <strong>{hi ? "दिनांक" : "Date"}:</strong> {date}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="QR" className="h-20 w-20" />}
        </header>

        <section className="mt-3">
          <p className="font-bold">{hi ? "परिवार के सदस्य" : "Family members"} ({active.length})</p>
          <p>{active.map((m) => `${m.name} (${RELATION_NAMES[m.relation][lang]}${m.profile.age !== undefined ? `, ${m.profile.age}` : ""})`).join(" · ")}</p>
        </section>

        <section className="mt-4">
          <p className="mb-1 font-bold">{hi ? `पात्र योजनाएँ (${rows.length})` : `Eligible schemes (${rows.length})`}</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                {[hi ? "योजना" : "Scheme", hi ? "किसके लिए" : "For", hi ? "लाभ" : "Benefit", hi ? "हेल्पलाइन" : "Helpline", hi ? "स्थिति" : "Status"].map((h) => (
                  <th key={h} className="border border-gray-400 px-2 py-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const who = r.members.filter((m) => m.verdict === "eligible");
                return (
                  <tr key={r.scheme.id} className="break-inside-avoid align-top">
                    <td className="border border-gray-400 px-2 py-1 font-semibold">
                      {r.scheme.name[lang]}
                      {r.scheme.intakeClosed && <span className="block font-normal italic">{hi ? "(नए पंजीयन अभी बंद)" : "(new registrations closed)"}</span>}
                      {r.scheme.eventBased && <span className="block font-normal italic">({r.scheme.eventBased[lang]})</span>}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">{r.level === "household" ? (hi ? "पूरा परिवार" : "Whole family") : who.map((m) => m.name).join(", ")}</td>
                    <td className="border border-gray-400 px-2 py-1">{r.scheme.benefit[lang]}</td>
                    <td className="border border-gray-400 px-2 py-1 whitespace-nowrap">{r.scheme.helpline ?? "181"}</td>
                    <td className="border border-gray-400 px-2 py-1 whitespace-nowrap">{statusOf(r.scheme.id, r.level, who.map((m) => m.memberId))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-4 break-inside-avoid">
          <p className="mb-1 font-bold">{hi ? "ये कागज़ तैयार रखें" : "Keep these documents ready"}</p>
          <ul className="grid grid-cols-2 gap-x-6">
            {match.checklist.map((c) => (
              <li key={c.doc.id}>☐ {c.doc.name[lang]} <span className="text-gray-600">({c.neededFor.length})</span></li>
            ))}
          </ul>
        </section>

        <footer className="mt-4 border-t border-gray-400 pt-2 text-[11px] text-gray-700">
          <p>
            {hi
              ? `कुल ${units.length} लाभ। यह पर्ची मार्गदर्शन के लिए है — अंतिम पात्रता संबंधित सरकारी कार्यालय तय करता है। आवेदन के लिए किसी को पैसे न दें। शिकायत: CM हेल्पलाइन 181।`
              : `${units.length} benefits in total. This slip is guidance only — final eligibility is decided by the concerned government office. Never pay anyone to apply. Complaints: CM Helpline 181.`}
          </p>
        </footer>
      </main>
    </div>
  );
}
