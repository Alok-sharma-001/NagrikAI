"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrefs } from "./ui";

/**
 * Site chrome modelled on Indian government portals (GIGW): utility strip with
 * skip-link, text size and language; white identity header; tricolour rule;
 * navy navigation bar; breadcrumb; navy footer with helplines and disclaimer.
 * It deliberately uses NagrikAI's own mark — never the national emblem — because
 * this is an independent citizen-assistance service, not a government website.
 */

type Me = { loggedIn: boolean; name?: string };

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const path = usePathname();
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ loggedIn: false }));
  }, [path]);
  return me;
}

const T = {
  skip: { en: "Skip to main content", hi: "मुख्य सामग्री पर जाएँ" },
  textSize: { en: "Text size", hi: "अक्षर का आकार" },
  title: { en: "NagrikAI", hi: "नागरिक AI" },
  subtitle: { en: "Government schemes for the citizens of Madhya Pradesh", hi: "मध्यप्रदेश के नागरिकों के लिए सरकारी योजनाओं की जानकारी" },
  login: { en: "Log in", hi: "लॉगिन" },
  register: { en: "Register", hi: "पंजीकरण" },
  home: { en: "Home", hi: "मुख्य पृष्ठ" },
  schemes: { en: "All Schemes", hi: "सभी योजनाएँ" },
  mySchemes: { en: "My Schemes", hi: "मेरी योजनाएँ" },
  family: { en: "My Family", hi: "मेरा परिवार" },
  check: { en: "Quick Check", hi: "तुरंत जाँचें" },
  help: { en: "Help", hi: "सहायता" },
  back: { en: "Back", hi: "पीछे" },
  sound: { en: "Sound", hi: "आवाज़" },
};

export function AppHeader({
  back,
  title,
  compact,
}: {
  back?: string | (() => void);
  title?: string;
  /** Hide the navigation bar (used inside step-by-step forms). */
  compact?: boolean;
}) {
  const { lang, setLang, sound, setSound, textSize, setTextSize } = usePrefs();
  const router = useRouter();
  const path = usePathname();
  const me = useMe();
  const goBack = () => (typeof back === "function" ? back() : back ? router.push(back) : router.back());

  const nav = me?.loggedIn
    ? [
        { href: "/home", label: T.mySchemes },
        { href: "/schemes", label: T.schemes },
        { href: "/family", label: T.family },
        { href: "/help", label: T.help },
      ]
    : [
        { href: "/", label: T.home },
        { href: "/schemes", label: T.schemes },
        { href: "/chat", label: T.check },
        { href: "/help", label: T.help },
      ];

  return (
    <header className="no-print">
      {/* Utility strip */}
      <div className="bg-navy text-[0.8rem] text-white/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5">
          <a href="#main" className="hidden underline-offset-2 hover:underline sm:inline">{T.skip[lang]}</a>
          <span className="flex-1" />
          <div className="flex items-center gap-1" role="group" aria-label={T.textSize[lang]}>
            {["अ-", "अ", "अ+"].map((l, i) => (
              <button
                key={l}
                onClick={() => setTextSize(i === 0 ? textSize - 1 : i === 1 ? 1 : textSize + 1)}
                className={`h-7 min-w-7 rounded px-1.5 ${i === 1 && textSize === 1 ? "bg-white/20" : "hover:bg-white/10"}`}
                aria-label={`${T.textSize[lang]} ${l}`}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-white/30" aria-hidden />
          <button onClick={() => setSound(!sound)} aria-pressed={sound} className="flex h-7 items-center gap-1 rounded px-2 hover:bg-white/10">
            {sound ? "🔊" : "🔇"} <span className="hidden sm:inline">{T.sound[lang]}</span>
          </button>
          <span className="h-4 w-px bg-white/30" aria-hidden />
          <button onClick={() => setLang(lang === "hi" ? "en" : "hi")} className="h-7 rounded px-2 font-semibold hover:bg-white/10" aria-label="Change language / भाषा बदलें">
            {lang === "hi" ? "English" : "हिंदी"}
          </button>
        </div>
      </div>

      {/* Identity header */}
      <div className="bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={me?.loggedIn ? "/home" : "/"} className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-12 w-12 shrink-0" />
            <span className="h-10 w-px bg-line" aria-hidden />
            <span className="min-w-0">
              <span className="block text-xl font-bold leading-tight text-primary sm:text-2xl">{T.title[lang]}</span>
              <span className="block truncate text-xs text-muted sm:text-sm">{T.subtitle[lang]}</span>
            </span>
          </Link>
          {me &&
            (me.loggedIn ? (
              <Link href="/family" className="hidden items-center gap-2 rounded-md border border-line px-3 py-2 text-sm sm:flex">
                <span aria-hidden>👤</span> {me.name}
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="hidden h-10 items-center rounded-md border border-primary px-4 text-sm font-semibold text-primary sm:flex">{T.login[lang]}</Link>
                <Link href="/register" className="flex h-10 items-center rounded-md bg-good px-4 text-sm font-semibold text-white">{T.register[lang]}</Link>
              </div>
            ))}
        </div>
        <div className="tricolor h-1" aria-hidden />
      </div>

      {/* Navigation */}
      {!compact && (
        <nav className="bg-primary" aria-label="Main">
          <ul className="mx-auto flex max-w-6xl overflow-x-auto px-2">
            {nav.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={`flex h-11 items-center whitespace-nowrap border-b-4 px-4 text-sm font-semibold text-white ${active ? "border-saffron bg-white/10" : "border-transparent hover:bg-white/10"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {n.label[lang]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Breadcrumb / page title */}
      {(back || title) && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            {back && (
              <button onClick={goBack} className="flex h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary hover:bg-primary-soft">
                ← {T.back[lang]}
              </button>
            )}
            {back && title && <span className="text-muted" aria-hidden>/</span>}
            {title && <h1 className="truncate text-base font-semibold">{title}</h1>}
          </div>
        </div>
      )}
    </header>
  );
}

const HELPLINES: { n: string; en: string; hi: string }[] = [
  { n: "14555", en: "Ayushman Bharat (health)", hi: "आयुष्मान भारत (स्वास्थ्य)" },
  { n: "155261", en: "PM-KISAN", hi: "पीएम-किसान" },
  { n: "1967", en: "Ration / food", hi: "राशन / खाद्य" },
  { n: "14434", en: "e-Shram (workers)", hi: "ई-श्रम (कामगार)" },
  { n: "181", en: "Women helpline", hi: "महिला हेल्पलाइन" },
];

export function SiteFooter() {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  return (
    <footer className="no-print mt-10 bg-navy text-white/85">
      <div className="tricolor h-1" aria-hidden />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 text-sm sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-white">{hi ? "नागरिक AI" : "NagrikAI"}</p>
          <p className="mt-2 leading-relaxed">
            {hi
              ? "एक स्वतंत्र नागरिक-सहायता सेवा जो आधिकारिक नियमों के आधार पर बताती है कि आपके परिवार को कौन सी सरकारी योजनाएँ मिल सकती हैं।"
              : "An independent citizen-assistance service that shows which government schemes your family may get, based on official rules."}
          </p>
          <p className="mt-3 text-xs text-white/70">{hi ? "टीम टेक गीक्स · विक्रांत विश्वविद्यालय, ग्वालियर" : "Team Tech Geeks · Vikrant University, Gwalior"}</p>
        </div>
        <div>
          <p className="section-title font-bold text-white">{hi ? "उपयोगी लिंक" : "Quick links"}</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/schemes" className="hover:underline">› {hi ? "सभी योजनाएँ" : "All schemes"}</Link></li>
            <li><Link href="/register" className="hover:underline">› {hi ? "परिवार का पंजीकरण" : "Register your family"}</Link></li>
            <li><Link href="/chat" className="hover:underline">› {hi ? "बिना पंजीकरण जाँचें" : "Check without registering"}</Link></li>
            <li><Link href="/help" className="hover:underline">› {hi ? "सहायता और हेल्पलाइन" : "Help & helplines"}</Link></li>
            <li><Link href="/officer" className="hover:underline">› {hi ? "अधिकारी डैशबोर्ड" : "Officer dashboard"}</Link></li>
          </ul>
        </div>
        <div>
          <p className="section-title font-bold text-white">{hi ? "महत्वपूर्ण हेल्पलाइन" : "Important helplines"}</p>
          <ul className="mt-3 space-y-1.5">
            {HELPLINES.map((h) => (
              <li key={h.n} className="flex justify-between gap-3">
                <span>{h[lang]}</span>
                <a href={`tel:${h.n}`} className="font-semibold text-white hover:underline">{h.n}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-3 text-xs text-white/70">
          <p>
            {hi
              ? "अस्वीकरण: यह सरकारी वेबसाइट नहीं है। अंतिम पात्रता संबंधित सरकारी विभाग तय करता है। आवेदन के लिए किसी को पैसे न दें।"
              : "Disclaimer: This is not a government website. Final eligibility is decided by the concerned department. Never pay anyone to apply."}
          </p>
          <p>{hi ? "हम कभी आधार या बैंक नंबर नहीं माँगते" : "We never ask for Aadhaar or bank numbers"}</p>
        </div>
      </div>
    </footer>
  );
}

/** Standard page frame: header, centred main column, footer. */
export function PageShell({
  children,
  back,
  title,
  wide,
}: {
  children: React.ReactNode;
  back?: string | (() => void);
  title?: string;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader back={back} title={title} />
      <main id="main" className={`mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
