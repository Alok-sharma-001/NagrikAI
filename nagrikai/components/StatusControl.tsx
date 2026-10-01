"use client";

import { useState } from "react";
import { useFamily, type BenefitStatus } from "./FamilyProvider";
import { api, usePrefs } from "./ui";

const OPTIONS: { value: BenefitStatus; icon: string; en: string; hi: string; on: string }[] = [
  { value: "receiving", icon: "✓", en: "Receiving", hi: "मिल रही है", on: "border-good bg-good text-white" },
  { value: "applied", icon: "⏳", en: "Applied", hi: "आवेदन किया", on: "border-warn bg-warn-soft text-warn" },
  { value: "rejected", icon: "✗", en: "Rejected", hi: "अस्वीकार हुआ", on: "border-bad bg-bad-soft text-bad" },
];

/** One tap to record where a benefit stands. Tapping the active choice clears it. */
export default function StatusControl({ schemeId, memberId }: { schemeId: string; memberId: string }) {
  const { data, refresh } = useFamily();
  const { lang } = usePrefs();
  const [busy, setBusy] = useState(false);
  const current = data?.statuses[`${schemeId}|${memberId}`];

  const set = async (v: BenefitStatus) => {
    setBusy(true);
    try {
      await api("/api/family/status", "PUT", { schemeId, memberId, status: current === v ? null : v });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 text-sm text-muted">{lang === "hi" ? "अभी क्या स्थिति है?" : "Where does it stand?"}</p>
      <div className="flex flex-wrap gap-2" role="group">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => set(o.value)}
            disabled={busy}
            aria-pressed={current === o.value}
            className={`flex h-11 items-center gap-1.5 rounded-md border-2 px-3 text-sm font-semibold disabled:opacity-60 ${current === o.value ? o.on : "border-line bg-surface hover:border-primary"}`}
          >
            <span aria-hidden>{o.icon}</span> {o[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatusChip({ status }: { status?: BenefitStatus }) {
  const { lang } = usePrefs();
  if (!status) return null;
  const o = OPTIONS.find((x) => x.value === status)!;
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${o.on}`}>{o.icon} {o[lang]}</span>;
}
