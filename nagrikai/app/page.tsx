"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader, SiteFooter } from "@/components/Shell";
import { IconBadge, usePrefs } from "@/components/ui";
import { CATEGORY_NAMES } from "@/lib/i18n";
import { SCHEMES } from "@/lib/kb";
import type { Category } from "@/lib/types";

const ORDER: Category[] = ["health", "food", "housing", "pension", "education", "women_child", "agriculture", "employment", "insurance", "business", "skill", "disability", "financial_inclusion", "energy", "sanitation"];

export default function Landing() {
  const { lang, say } = usePrefs();
  const router = useRouter();
  const [q, setQ] = useState("");
  const hi = lang === "hi";

  // Registered on this phone? Go straight to the family's schemes.
  useEffect(() => {
    fetch("/api/family").then((r) => r.ok && router.replace("/home")).catch(() => {});
  }, [router]);

  const counts = useMemo(() => {
    const c = new Map<Category, number>();
    for (const s of SCHEMES) c.set(s.category, (c.get(s.category) ?? 0) + 1);
    return c;
  }, []);

  const intro = hi
    ? "नमस्ते! एक बार अपने परिवार की जानकारी दें। हम बताएँगे कि आपके परिवार को कौन सी सरकारी योजनाएँ मिल सकती हैं, कौन से कागज़ चाहिए, और आवेदन कहाँ करना है।"
    : "Namaste! Tell us about your family once. We'll show which government schemes your family can get, which papers you need, and where to apply.";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="border-b border-line bg-gradient-to-b from-primary-soft to-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.3fr_1fr] md:py-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-primary shadow-sm">
                {hi ? "मध्यप्रदेश · हर नागरिक, हर योजना" : "Madhya Pradesh · Every citizen, every scheme"}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-ink md:text-5xl">
                {hi ? "मध्यप्रदेश की हर सरकारी योजना, आपके परिवार के लिए" : "Every government scheme in Madhya Pradesh, for your family"}
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{intro}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register" className="flex h-14 items-center gap-2 rounded-md bg-good px-6 text-lg font-bold text-white shadow-sm hover:brightness-110">
                  📝 {hi ? "परिवार का पंजीकरण करें" : "Register your family"}
                </Link>
                <Link href="/login" className="flex h-14 items-center rounded-md border-2 border-primary bg-surface px-6 text-lg font-bold text-primary">
                  {hi ? "लॉगिन करें" : "Log in"}
                </Link>
                <button onClick={() => say(intro)} className="flex h-14 items-center gap-2 rounded-md border border-line bg-surface px-4 text-lg" aria-label={hi ? "सुनें" : "Listen"}>
                  🔊 <span className="text-base">{hi ? "सुनें" : "Listen"}</span>
                </button>
              </div>
              <p className="mt-4 text-sm text-muted">
                🪪 {hi ? "समग्र ID से पूरा परिवार अपने आप जुड़ता है" : "Your Samagra ID links the whole family automatically"}
                {" · "}
                <Link href="/chat" className="font-semibold text-primary underline">{hi ? "बिना पंजीकरण जाँचें" : "Check without registering"}</Link>
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
              <p className="section-title text-lg font-bold text-primary">{hi ? "योजना खोजें" : "Search schemes"}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  router.push(`/schemes${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
                }}
                className="mt-4 flex gap-2"
              >
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={hi ? "जैसे: पेंशन, छात्रवृत्ति, गैस…" : "e.g. pension, scholarship, gas…"}
                  className="h-12 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 outline-none focus:border-primary"
                  aria-label={hi ? "योजना खोजें" : "Search schemes"}
                />
                <button className="h-12 rounded-md bg-primary px-4 font-semibold text-primary-ink">{hi ? "खोजें" : "Search"}</button>
              </form>
              <p className="mt-4 text-sm font-semibold text-muted">{hi ? "लोकप्रिय खोजें" : "Popular searches"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(hi ? ["आयुष्मान कार्ड", "पेंशन", "छात्रवृत्ति", "उज्ज्वला गैस", "पीएम आवास", "किसान"] : ["Ayushman card", "Pension", "Scholarship", "Ujjwala gas", "PM Awas", "Farmer"]).map((t) => (
                  <Link key={t} href={`/schemes?q=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-bg px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
                    {t}
                  </Link>
                ))}
              </div>
              <ul className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
                {[
                  ["🎤", hi ? "बोलकर जानकारी दें — पढ़ना-लिखना ज़रूरी नहीं" : "Speak instead of typing — no reading needed"],
                  ["👨‍👩‍👧", hi ? "पूरे परिवार की योजनाएँ एक साथ" : "Schemes for the whole family together"],
                  ["🔒", hi ? "आधार या बैंक नंबर कभी नहीं माँगा जाता" : "Never asks for Aadhaar or bank numbers"],
                ].map(([i, t]) => (
                  <li key={t} className="flex items-center gap-3"><IconBadge icon={i} size="sm" /> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="bg-primary text-primary-ink">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 md:grid-cols-4">
            {[
              [String(SCHEMES.length), hi ? "योजनाएँ — म.प्र. + केंद्र" : "Schemes — MP + central"],
              [String(ORDER.length), hi ? "श्रेणियाँ" : "Categories"],
              ["2", hi ? "भाषाएँ — हिंदी, English" : "Languages — Hindi, English"],
              ["₹0", hi ? "पूरी तरह मुफ़्त" : "Completely free"],
            ].map(([n, l]) => (
              <div key={l} className="px-2 py-5 text-center">
                <p className="text-3xl font-bold">{n}</p>
                <p className="text-sm opacity-90">{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="section-title center text-center text-2xl font-bold">{hi ? "श्रेणी के अनुसार योजनाएँ" : "Schemes by category"}</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ORDER.filter((c) => counts.get(c)).map((c) => (
              <Link
                key={c}
                href={`/schemes?cat=${c}`}
                className="group flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <IconBadge icon={CATEGORY_NAMES[c].icon} />
                <span className="font-semibold group-hover:text-primary">{CATEGORY_NAMES[c][lang]}</span>
                <span className="text-xs text-muted">{counts.get(c)} {hi ? "योजनाएँ" : "schemes"}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h2 className="section-title center text-center text-2xl font-bold">{hi ? "कैसे काम करता है" : "How it works"}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ["📝", hi ? "एक बार जानकारी दें" : "Tell us once", hi ? "तस्वीरों वाले आसान सवाल — बोलकर या छूकर जवाब दें। परिवार के सदस्य भी जोड़ें।" : "Simple picture questions — answer by voice or touch. Add family members too."],
                ["🔍", hi ? "अपनी योजनाएँ देखें" : "See your schemes", hi ? "आधिकारिक नियमों से जाँच — कौन सी योजना किसे मिलेगी और क्यों।" : "Checked against official rules — which scheme each person can get, and why."],
                ["✅", hi ? "आवेदन करें" : "Apply", hi ? "ज़रूरी कागज़ों की सूची, आवेदन की जगह, हेल्पलाइन और अंतिम तिथियाँ।" : "Document checklist, where to apply, helplines and last dates."],
              ].map(([i, t, d], idx) => (
                <li key={t} className="relative rounded-lg border border-line bg-bg p-5">
                  <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{idx + 1}</span>
                  <IconBadge icon={i} tone="green" />
                  <p className="mt-3 text-lg font-bold">{t}</p>
                  <p className="mt-1 text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Family CTA */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col items-start gap-4 rounded-lg bg-navy p-6 text-white md:flex-row md:items-center">
            <IconBadge icon="👨‍👩‍👧‍👦" size="lg" tone="saffron" />
            <div className="flex-1">
              <p className="text-xl font-bold">{hi ? "पूरे परिवार को जोड़ें, ज़्यादा लाभ पाएँ" : "Add your whole family, get more benefits"}</p>
              <p className="mt-1 text-white/80">
                {hi ? "बच्चों की छात्रवृत्ति, बुज़ुर्गों की पेंशन, महिलाओं की योजनाएँ — सब एक ही जगह।" : "Children's scholarships, elders' pensions, women's schemes — all in one place."}
              </p>
            </div>
            <Link href="/register" className="flex h-12 items-center rounded-md bg-saffron px-6 font-bold text-navy">{hi ? "अभी शुरू करें →" : "Start now →"}</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
