"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, usePrefs } from "@/components/ui";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { Keypad } from "@/components/Wizard";

export default function Login() {
  const { lang, say } = usePrefs();
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState<"mobile" | "pin">("mobile");
  const [error, setError] = useState<string | null>(null);
  const hi = lang === "hi";
  const submitMobile = (m: string) => {
    setError(null);
    setMobile(m);
    if (!/^[6-9]\d{9}$/.test(m)) return fail(hi ? "सही 10 अंकों का मोबाइल नंबर डालें" : "Enter a valid 10-digit mobile number");
    setStage("pin");
    say(hi ? "अपना 4 अंकों का PIN डालें" : "Enter your 4-digit PIN");
  };
  const submitPin = async (pin: string) => {
    setError(null);
    if (pin.length !== 4) return;
    try {
      await api("/api/auth/login", "POST", { mobile, pin });
      router.replace("/home");
    } catch (e) {
      const code = (e as { code?: string }).code;
      fail(code === "LOCKED" ? (hi ? "बहुत बार गलत PIN। 15 मिनट बाद कोशिश करें।" : "Too many wrong tries. Try after 15 minutes.") : hi ? "मोबाइल नंबर या PIN गलत है" : "Wrong mobile number or PIN");
    }
  };
  const fail = (m: string) => {
    setError(m);
    say(m);
    setRound((r) => r + 1); // fresh keypad
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader back={stage === "pin" ? () => setStage("mobile") : "/"} title={hi ? "लॉगिन" : "Log in"} />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="border-b border-line bg-primary px-5 py-3 text-primary-ink">
          <p className="text-sm opacity-90">{hi ? "नागरिक लॉगिन" : "Citizen login"}</p>
          <p className="text-lg font-bold">{stage === "mobile" ? (hi ? "चरण 1 / 2 — मोबाइल नंबर" : "Step 1 / 2 — Mobile number") : hi ? "चरण 2 / 2 — PIN" : "Step 2 / 2 — PIN"}</p>
        </div>
        <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-4xl" aria-hidden>{stage === "mobile" ? "📱" : "🔒"}</span>
          <h1 className="text-xl font-bold">{stage === "mobile" ? (hi ? "अपना मोबाइल नंबर डालें" : "Your mobile number") : hi ? "अपना PIN डालें" : "Your PIN"}</h1>
        </div>
        {error && <p role="alert" className="mb-3 rounded-md bg-bad-soft p-3 text-center text-bad">{error}</p>}
        {stage === "mobile" ? (
          <Keypad key={"m" + round} initial={mobile} maxLen={10} auto onDone={submitMobile} />
        ) : (
          <Keypad key={"p" + round} initial="" maxLen={4} mask auto onDone={submitPin} />
        )}
        </div>
        </div>
        <p className="mt-4 text-center text-sm">
          {hi ? "नया खाता?" : "New here?"} <a href="/register" className="font-semibold text-primary underline">{hi ? "परिवार का पंजीकरण करें" : "Register your family"}</a>
        </p>
        <p className="mt-2 text-center text-sm text-muted">
          {hi ? "PIN भूल गए? OTP से PIN बदलने की सुविधा जल्द आएगी।" : "Forgot PIN? Resetting by OTP is coming soon."}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
