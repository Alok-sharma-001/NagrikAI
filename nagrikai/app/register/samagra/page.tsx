"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, SiteFooter } from "@/components/Shell";
import Wizard, { Keypad } from "@/components/Wizard";
import { api, IconBadge, usePrefs } from "@/components/ui";
import { RELATION_NAMES, type Household, type MemberProfile, type Relation } from "@/lib/family";
import { answersToProfile, profileToAnswers, type Answers } from "@/lib/wizard";

type LookupMember = { memberId: string; maskedName: string; age: number; gender: string; relation: Relation; canVerify: boolean };
type Lookup = { familyId: string; district: string; members: LookupMember[]; alreadyRegistered: boolean; demo: boolean };
type Otp = { ticketId: string; mobileMasked: string; demoOtp?: string };
type Verified = {
  familyExists: boolean;
  alreadyHasLogin: boolean;
  self: { name: string; relation: Relation; profile: MemberProfile };
  household: Household;
  members: { name: string; relation: Relation; age?: number; gender?: string }[];
};

const DEMO_IDS = ["31245678", "42876501", "50917342", "27654019"];
const icon = (g: string, age: number) => (age < 13 ? (g === "female" ? "👧" : "👦") : age >= 60 ? (g === "female" ? "👵" : "👴") : g === "female" ? "👩" : "👨");

/** Register with the Samagra family ID: the whole family is linked from the registry — no family code. */
export default function SamagraRegister() {
  const { lang, say } = usePrefs();
  const router = useRouter();
  const hi = lang === "hi";
  const [stage, setStage] = useState<"id" | "pick" | "otp" | "wizard" | "done">("id");
  const [fam, setFam] = useState<Lookup | null>(null);
  const [picked, setPicked] = useState<LookupMember | null>(null);
  const [otp, setOtp] = useState<Otp | null>(null);
  const [ver, setVer] = useState<Verified | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const fail = (m: string) => {
    setError(m);
    say(m);
    setRound((r) => r + 1);
  };

  const lookup = async (id: string) => {
    setError(null);
    if (!/^\d{8}$/.test(id)) return fail(hi ? "समग्र परिवार ID 8 अंकों की होती है।" : "A Samagra family ID has 8 digits.");
    try {
      setFam(await api<Lookup>("/api/samagra/lookup", "POST", { familyId: id }));
      setStage("pick");
    } catch {
      fail(hi ? "यह समग्र परिवार ID नहीं मिली। दोबारा जाँचें।" : "This Samagra family ID was not found. Please check.");
    }
  };

  const pick = async (m: LookupMember) => {
    setError(null);
    setPicked(m);
    try {
      setOtp(await api<Otp>("/api/samagra/otp", "POST", { familyId: fam!.familyId, memberId: m.memberId }));
      setStage("otp");
    } catch {
      fail(hi ? "इस सदस्य का मोबाइल समग्र में दर्ज नहीं है। परिवार का कोई दूसरा सदस्य चुनें।" : "No mobile is registered in Samagra for this member. Choose another family member.");
    }
  };

  const verify = async (code: string) => {
    setError(null);
    try {
      const v = await api<Verified>("/api/samagra/verify", "POST", { ticketId: otp!.ticketId, otp: code });
      if (v.alreadyHasLogin) return fail(hi ? "आप पहले से पंजीकृत हैं। कृपया लॉगिन करें।" : "You are already registered. Please log in.");
      setVer(v);
      setStage("wizard");
    } catch (e) {
      const c = (e as { code?: string }).code;
      fail(c === "WRONG" ? (hi ? "OTP गलत है। दोबारा डालें।" : "Wrong OTP. Try again.") : hi ? "OTP की समय सीमा समाप्त हो गई। दोबारा शुरू करें।" : "OTP expired. Please start again.");
    }
  };

  if (stage === "wizard" && ver) {
    const known = { ...ver.household, ...ver.self.profile };
    const initial: Answers = { ...profileToAnswers(known), name: ver.self.name, relation: ver.self.relation };
    // Everything the registry already told us is never asked again.
    const hide = (["code", "relation", "name", ...Object.keys(initial)] as (keyof Answers)[]).filter((k) => !["mobile", "pin", "consent"].includes(k));
    return (
      <Wizard
        mode={ver.familyExists ? "join" : "new"}
        title={hi ? `${ver.self.name} — बची हुई जानकारी` : `${ver.self.name} — remaining details`}
        initial={initial}
        hide={hide}
        submitLabel={{ en: "All correct — register", hi: "सब सही है — पंजीकरण करें" }}
        onExit={() => setStage("otp")}
        onSubmit={async (a) => {
          try {
            await api("/api/auth/register-samagra", "POST", { ticketId: otp!.ticketId, profile: answersToProfile(a), mobile: a.mobile, pin: a.pin, consent: a.consent === true });
            setStage("done");
          } catch (e) {
            const c = (e as { code?: string }).code;
            if (c === "MOBILE_TAKEN") return { error: hi ? "यह मोबाइल नंबर पहले से पंजीकृत है। दूसरा नंबर डालें।" : "This mobile is already registered. Use another number.", goTo: "mobile" as const };
            return { error: hi ? "कुछ गड़बड़ हुई, फिर से कोशिश करें।" : "Something went wrong, please try again." };
          }
        }}
      />
    );
  }

  const back = stage === "id" ? "/register" : () => { setError(null); setStage(stage === "otp" ? "pick" : "id"); };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader back={stage === "done" ? undefined : back} title={hi ? "समग्र ID से पंजीकरण" : "Register with Samagra ID"} compact />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <div className="border-b border-line bg-surface-2 px-5 py-3 text-sm">
            <span className="font-semibold text-primary">{hi ? "परिवार की पहचान" : "Identify your family"}</span>
            <span className="float-right text-muted">
              {hi ? "चरण" : "Step"} {{ id: 1, pick: 2, otp: 3, wizard: 4, done: 4 }[stage]} / 4
            </span>
          </div>
          <div className="p-5">
            {stage === "id" && (
              <>
                <Title icon="🪪" q={hi ? "अपनी समग्र परिवार ID डालें" : "Enter your Samagra family ID"} hint={hi ? "8 अंकों की — राशन कार्ड, समग्र कार्ड या ग्राम पंचायत / वार्ड कार्यालय से मिलेगी" : "8 digits — on your ration card, Samagra card, or from the Gram Panchayat / ward office"} />
                <Keypad key={round} initial="" maxLen={8} auto onDone={lookup} />
                <div className="mt-5 rounded-md border border-dashed border-saffron bg-accent-soft p-3 text-sm">
                  <p className="font-semibold">🧪 {hi ? "डेमो मोड — नकली परिवार" : "Demo mode — fictional families"}</p>
                  <p className="mt-1 text-muted">{hi ? "असली समग्र से जुड़ने के लिए सरकारी अनुमति चाहिए। अभी इन डेमो ID से आज़माएँ:" : "Connecting to the real Samagra registry needs government approval. Try these demo IDs:"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DEMO_IDS.map((d) => (
                      <button key={d} onClick={() => lookup(d)} className="rounded-md border border-line bg-surface px-3 py-1.5 font-mono font-semibold hover:border-primary">{d}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {stage === "pick" && fam && (
              <>
                <Title icon="👨‍👩‍👧" q={hi ? "इनमें से आप कौन हैं?" : "Which of these is you?"} hint={hi ? `समग्र में ${fam.members.length} सदस्य मिले · ज़िला ${fam.district}` : `${fam.members.length} members found in Samagra · ${fam.district} district`} />
                {fam.alreadyRegistered && (
                  <p className="mb-3 rounded-md bg-good-soft p-3 text-sm text-good">✓ {hi ? "आपका परिवार पहले से जुड़ा है — आप सीधे उसमें जुड़ जाएँगे।" : "Your family is already linked — you'll join it directly."}</p>
                )}
                <ul className="space-y-2">
                  {fam.members.map((m) => (
                    <li key={m.memberId}>
                      <button
                        onClick={() => pick(m)}
                        disabled={!m.canVerify}
                        className="flex w-full items-center gap-3 rounded-lg border-2 border-line bg-surface p-3 text-left hover:border-primary disabled:opacity-50"
                      >
                        <IconBadge icon={icon(m.gender, m.age)} tone="grey" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg font-semibold">{m.maskedName}</span>
                          <span className="text-sm text-muted">
                            {RELATION_NAMES[m.relation][lang]} · {m.age} {hi ? "वर्ष" : "yrs"}
                            {!m.canVerify && ` · ${hi ? "मोबाइल दर्ज नहीं" : "no mobile on record"}`}
                          </span>
                        </span>
                        <span className="text-2xl text-muted" aria-hidden>›</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">🔒 {hi ? "नाम अधूरे दिख रहे हैं ताकि कोई और आपकी जानकारी न देख सके। OTP के बाद पूरी जानकारी दिखेगी।" : "Names are partly hidden so nobody else can see your details. Full details appear after the OTP."}</p>
              </>
            )}

            {stage === "otp" && otp && picked && (
              <>
                <Title icon="📲" q={hi ? "OTP डालें" : "Enter the OTP"} hint={hi ? `समग्र में दर्ज मोबाइल ${otp.mobileMasked} पर 6 अंकों का OTP भेजा गया` : `A 6-digit OTP was sent to ${otp.mobileMasked}, the mobile registered in Samagra`} />
                {otp.demoOtp && (
                  <p className="mb-4 rounded-md border border-dashed border-saffron bg-accent-soft p-3 text-sm">
                    🧪 {hi ? "डेमो मोड: असली सिस्टम में यह OTP SMS से आएगा। डेमो OTP:" : "Demo mode: in the real system this arrives by SMS. Demo OTP:"}{" "}
                    <span className="font-mono text-lg font-bold tracking-widest">{otp.demoOtp}</span>
                  </p>
                )}
                <Keypad key={round} initial="" maxLen={6} auto onDone={verify} />
              </>
            )}

            {stage === "done" && ver && (
              <div className="text-center">
                <p className="text-6xl" aria-hidden>🎉</p>
                <h2 className="mt-2 text-2xl font-bold">{hi ? "पूरा परिवार जुड़ गया!" : "Your whole family is linked!"}</h2>
                <p className="mt-1 text-muted">{hi ? "कोई कोड नहीं, कोई मंज़ूरी नहीं — समग्र से सीधे।" : "No code, no approval — straight from Samagra."}</p>
                <ul className="mx-auto mt-4 max-w-sm divide-y divide-line rounded-md border border-line text-left">
                  {ver.members.map((m) => (
                    <li key={m.name} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-2xl" aria-hidden>{icon(m.gender ?? "", m.age ?? 30)}</span>
                      <span className="flex-1 font-semibold">{m.name}</span>
                      <span className="text-sm text-muted">{RELATION_NAMES[m.relation][lang]} · {m.age}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => router.replace("/home")} className="mt-5 h-14 w-full rounded-md bg-good text-lg font-bold text-white">
                  📋 {hi ? "परिवार की योजनाएँ देखें" : "See your family's schemes"}
                </button>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-md border border-bad/30 bg-bad-soft p-3 text-bad">{error}</p>}
          </div>
        </div>
        {stage === "id" && (
          <p className="mt-4 text-center text-sm">
            {hi ? "समग्र ID नहीं है या याद नहीं?" : "No Samagra ID, or can't remember it?"}{" "}
            <Link href="/register?manual=1" className="font-semibold text-primary underline">{hi ? "बिना समग्र ID पंजीकरण करें" : "Register without it"}</Link>
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Title({ icon, q, hint }: { icon: string; q: string; hint: string }) {
  return (
    <div className="mb-5 flex items-start gap-4">
      <IconBadge icon={icon} size="lg" />
      <div className="pt-1">
        <h2 className="text-2xl font-bold leading-snug">{q}</h2>
        <p className="mt-1 text-muted">{hint}</p>
      </div>
    </div>
  );
}
