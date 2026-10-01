"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Wizard from "@/components/Wizard";
import { BigButton, api, usePrefs } from "@/components/ui";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { answersToProfile } from "@/lib/wizard";

export default function RegisterPage() {
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}

function Register() {
  const manual = useSearchParams().get("manual") === "1";
  const { lang, say } = usePrefs();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const hi = lang === "hi";

  if (code) {
    const msg = hi
      ? `पंजीकरण हो गया! आपका परिवार कोड है ${code.split("").join(" ")}। परिवार के दूसरे सदस्य इस कोड से जुड़ सकते हैं।`
      : `Registered! Your family code is ${code.split("").join(" ")}. Other family members can join with this code.`;
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <SayOnce text={msg} say={say} />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8">
          <div className="overflow-hidden rounded-lg border border-good/40 bg-surface text-center shadow-sm">
            <div className="bg-good px-5 py-2 text-sm font-semibold text-white">{hi ? "पंजीकरण सफल" : "Registration successful"}</div>
            <div className="p-6">
            <p className="text-6xl" aria-hidden>🎉</p>
            <h1 className="mt-2 text-2xl font-bold">{hi ? "पंजीकरण हो गया!" : "You're registered!"}</h1>
            <p className="mt-4 text-lg">{hi ? "आपका परिवार कोड" : "Your family code"}</p>
            <p className="mx-auto mt-2 w-fit rounded-md border-2 border-dashed border-primary bg-primary-soft px-5 py-2 font-mono text-4xl font-bold tracking-[0.25em] text-primary">{code}</p>
            <p className="mt-3 text-muted">{hi ? "इसे लिख लें। परिवार के सदस्य इस कोड से अपने फ़ोन पर जुड़ सकते हैं।" : "Write it down. Family members can join from their own phone with this code."}</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent((hi ? "नागरिक AI पर हमारे परिवार से जुड़ें। परिवार कोड: " : "Join our family on NagrikAI. Family code: ") + code)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-good px-5 font-semibold text-white"
            >
              📤 {hi ? "WhatsApp पर भेजें" : "Share on WhatsApp"}
            </a>
            </div>
          </div>
          <BigButton href="/family/add" tone="primary" icon="➕" label={hi ? "परिवार के सदस्य जोड़ें" : "Add family members"} sub={hi ? "बच्चे, पति/पत्नी, माता-पिता — जितने ज़्यादा सदस्य, उतनी ज़्यादा योजनाएँ" : "Children, spouse, parents — more members, more schemes"} />
          <BigButton href="/home" icon="📋" label={hi ? "मेरी योजनाएँ देखें" : "See my schemes"} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  // First choice: the easy way (Samagra ID links the whole family) or the manual way.
  if (!manual) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader back="/" title={hi ? "परिवार का पंजीकरण" : "Register your family"} />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8">
          <h1 className="section-title text-2xl font-bold">{hi ? "पंजीकरण कैसे करना चाहेंगे?" : "How would you like to register?"}</h1>
          <Link href="/register/samagra" className="block rounded-lg border-2 border-good bg-surface p-5 shadow-sm transition hover:shadow-md">
            <span className="rounded bg-good px-2 py-0.5 text-xs font-bold text-white">{hi ? "सबसे आसान" : "Easiest"}</span>
            <p className="mt-2 text-xl font-bold">🪪 {hi ? "समग्र परिवार ID से" : "With Samagra family ID"}</p>
            <p className="mt-1 text-muted">
              {hi
                ? "एक नंबर डालें — पूरा परिवार (नाम, उम्र, रिश्ते) अपने आप जुड़ जाएगा। कोई परिवार कोड नहीं, बहुत कम सवाल।"
                : "Enter one number — your whole family (names, ages, relations) is linked automatically. No family code, very few questions."}
            </p>
          </Link>
          <Link href="/register?manual=1" className="block rounded-lg border border-line bg-surface p-5 shadow-sm transition hover:shadow-md">
            <p className="text-xl font-bold">📝 {hi ? "बिना समग्र ID" : "Without Samagra ID"}</p>
            <p className="mt-1 text-muted">{hi ? "सवालों के जवाब देकर पंजीकरण करें; परिवार के सदस्य बाद में जोड़ें।" : "Answer the questions yourself; add family members afterwards."}</p>
          </Link>
          <p className="text-sm text-muted">
            ℹ️ {hi
              ? "आधार नंबर क्यों नहीं? आधार में परिवार के रिश्ते दर्ज नहीं होते, और आधार नंबर लेना-रखना केवल अधिकृत संस्थाएँ कर सकती हैं। मध्यप्रदेश में परिवार की पहचान समग्र ID से होती है।"
              : "Why not Aadhaar? Aadhaar holds no family relationships, and only authorised bodies may collect Aadhaar numbers. In Madhya Pradesh the family is identified by the Samagra ID."}
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <Wizard
      mode="new"
      title={hi ? "नया पंजीकरण" : "Register"}
      submitLabel={{ en: "All correct — register", hi: "सब सही है — पंजीकरण करें" }}
      onExit={() => router.push("/")}
      onSubmit={async (a) => {
        try {
          const res = await api<{ familyCode: string }>("/api/auth/register", "POST", {
            name: a.name,
            profile: answersToProfile(a),
            mobile: a.mobile,
            pin: a.pin,
            consent: a.consent === true,
          });
          setCode(res.familyCode);
        } catch (e) {
          const err = e as Error & { code?: string };
          if (err.code === "MOBILE_TAKEN")
            return { error: hi ? "यह मोबाइल नंबर पहले से पंजीकृत है। लॉगिन करें या दूसरा नंबर डालें।" : "This mobile is already registered. Log in or use another number.", goTo: "mobile" };
          return { error: hi ? "कुछ गड़बड़ हुई, फिर से कोशिश करें।" : "Something went wrong, please try again." };
        }
      }}
    />
  );
}

function SayOnce({ text, say }: { text: string; say: (t: string) => void }) {
  useEffect(() => {
    say(text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
