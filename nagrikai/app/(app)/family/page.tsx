"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memberIcon, useFamily } from "@/components/FamilyProvider";
import { api, BigButton, IconBadge, usePrefs } from "@/components/ui";
import { PageShell } from "@/components/Shell";
import { RELATION_NAMES } from "@/lib/family";

export default function FamilyPage() {
  const { data, refresh } = useFamily();
  const { lang } = usePrefs();
  const router = useRouter();
  const hi = lang === "hi";
  if (!data) return <div className="flex min-h-dvh items-center justify-center text-muted">…</div>;
  const { me, family, match } = data;
  const active = me.status === "active";

  const logout = async () => {
    await api("/api/auth/logout", "POST");
    router.replace("/");
  };
  const wipe = async () => {
    if (!confirm(hi ? "क्या आप परिवार की सारी जानकारी हमेशा के लिए मिटाना चाहते हैं?" : "Delete all of your family's data permanently?")) return;
    await api("/api/family", "DELETE");
    router.replace("/");
  };

  return (
    <PageShell back="/home" title={hi ? "मेरा परिवार" : "My family"}>
      <div className="space-y-4">
        {active && family.samagraId && (
          <section className="rounded-lg border border-good/40 bg-good-soft p-5 text-center">
            <p className="font-semibold text-good">🪪 {hi ? "समग्र से जुड़ा परिवार" : "Family linked through Samagra"}</p>
            <p className="font-mono text-3xl font-bold tracking-[0.2em]">••••{family.samagraId.slice(-4)}</p>
            <p className="mt-1 text-sm text-muted">
              {hi
                ? "परिवार के दूसरे सदस्य अपने फ़ोन पर “समग्र ID से पंजीकरण” चुनें — वे सीधे इसी परिवार में जुड़ जाएँगे, कोई कोड नहीं चाहिए।"
                : "Other members just choose “Register with Samagra ID” on their phone — they join this family directly, no code needed."}
            </p>
          </section>
        )}
        {active && family.code && !family.samagraId && (
          <section className="rounded-lg border border-primary/30 bg-primary-soft p-5 text-center">
            <p>{hi ? "परिवार कोड" : "Family code"}</p>
            <p className="font-mono text-4xl font-bold tracking-[0.25em] text-primary">{family.code}</p>
            <p className="mt-1 text-sm text-muted">{hi ? "परिवार के सदस्य इस कोड से अपने फ़ोन पर जुड़ सकते हैं" : "Family members can join from their own phone with this code"}</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent((hi ? "नागरिक AI पर हमारे परिवार से जुड़ें। परिवार कोड: " : "Join our family on NagrikAI. Family code: ") + family.code)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-md bg-good px-5 font-semibold text-white"
            >
              📤 {hi ? "WhatsApp पर भेजें" : "Share on WhatsApp"}
            </a>
          </section>
        )}

        <ul className="space-y-3">
          {family.members.map((m) => {
            const count = match.perMember.find((p) => p.memberId === m.id)?.eligible;
            const canEdit = m.id === me.id || (active && (me.isHead || !m.hasLogin));
            return (
              <li key={m.id} className="rounded-lg border border-line bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <IconBadge icon={memberIcon(m)} tone="grey" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold">
                      {m.name} {m.isHead && <span className="rounded bg-primary-soft px-1.5 text-xs text-primary">{hi ? "मुखिया" : "Head"}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {RELATION_NAMES[m.relation][lang]}
                      {m.profile.age !== undefined && ` · ${m.profile.age} ${hi ? "साल" : "yrs"}`}
                      {m.hasLogin && ` · 📱`}
                    </p>
                  </div>
                  {m.status === "active" && count !== undefined && <span className="rounded-full bg-good-soft px-3 py-1 font-bold text-good">✓ {count}</span>}
                </div>
                {m.status === "pending" && (
                  <div className="mt-3 rounded-md bg-warn-soft p-3">
                    <p className="text-warn">⏳ {hi ? "परिवार कोड से जुड़ना चाहते हैं" : "Wants to join with the family code"}</p>
                    {me.isHead && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={async () => { await api(`/api/family/members/${m.id}`, "PATCH", { approve: true }); refresh(); }} className="h-12 flex-1 rounded-md bg-good font-bold text-white">
                          ✅ {hi ? "मंज़ूर करें" : "Approve"}
                        </button>
                        <button onClick={async () => { await api(`/api/family/members/${m.id}`, "DELETE"); refresh(); }} className="h-12 flex-1 rounded-md border border-line">
                          ❌ {hi ? "हटाएँ" : "Remove"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {canEdit && m.status === "active" && (
                  <div className="mt-3 flex gap-2">
                    <Link href={`/family/edit/${m.id}`} className="flex h-12 flex-1 items-center justify-center rounded-md border border-line font-semibold">✎ {hi ? "जानकारी बदलें" : "Edit details"}</Link>
                    <Link href={`/home?who=${m.id}`} className="flex h-12 flex-1 items-center justify-center rounded-md border border-line font-semibold">📋 {hi ? "योजनाएँ" : "Schemes"}</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {active && (
          <>
            <BigButton href="/family/add" tone="good" icon="➕" label={hi ? "सदस्य जोड़ें" : "Add a member"} sub={hi ? "बच्चे, बुज़ुर्ग या जिनके पास फ़ोन नहीं है" : "Children, elders, or anyone without a phone"} />
            <BigButton href="/family/household" icon="🏠" label={hi ? "घर की जानकारी बदलें" : "Edit home details"} sub={hi ? "राशन कार्ड, घर, कमाई, गैस…" : "Ration card, house, income, gas…"} />
          </>
        )}
        <BigButton onClick={logout} icon="🚪" label={hi ? "लॉगआउट" : "Log out"} />
        {me.isHead && (
          <button onClick={wipe} className="w-full rounded-md py-4 text-bad underline">
            🗑️ {hi ? "परिवार की सारी जानकारी मिटाएँ" : "Delete all family data"}
          </button>
        )}
      </div>
    </PageShell>
  );
}
