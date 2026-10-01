import howto from "@/data/howto.json";
import { evaluateScheme } from "./eligibility";
import type { Relation } from "./family";
import { getDocument } from "./kb";
import { answerRules } from "./reply";
import { mentionedSchemes, searchSchemes } from "./search";
import type { Category, Lang, MatchResult, Profile, Scheme, Text, Verdict } from "./types";

/**
 * The assistant's brain when no language model is connected — and the grounding
 * for it when one is. It recognises what KIND of question was asked before
 * looking for a scheme, so "who are you?", "my payment didn't come", "how do I
 * get a Samagra ID?" and "which scheme pays most?" each get a real answer
 * instead of a random scheme description.
 */

export type Person = { id?: string; name?: string; relation?: Relation; profile: Profile };
export type AnswerScheme = { id: string; name: Text; verdict: Verdict; category: Category; for?: string };
export type AnswerKind = "smalltalk" | "howto" | "problem" | "ranking" | "compare" | "scheme" | "none";
export type Answer = {
  kind: AnswerKind;
  text: string;
  schemes: AnswerScheme[];
  /** Official page for a how-to answer. */
  link?: { label: string; url: string };
  /** Follow-up questions to offer as chips. */
  suggestions: Text[];
  /** Verdicts behind the answer, for grounding a language model. */
  results: MatchResult[];
  resultNames: (string | undefined)[];
};

type Article = { id: string; match: string; title: Text; steps: Text[]; url: string; helpline: string | null };
const ARTICLES = (howto as Article[]).map((a) => ({ ...a, re: new RegExp(a.match.normalize("NFC"), "i") }));

const RANK = { eligible: 0, possible: 1, ineligible: 2 } as const;
const value = (s: Scheme) => (s.benefit.cashPerYear ?? 0) + (s.benefit.oneTime ?? 0);

const SUGGEST: Text[] = [
  { en: "Which schemes can my family get?", hi: "मेरे परिवार को कौन सी योजनाएँ मिल सकती हैं?" },
  { en: "Which scheme gives the most money?", hi: "सबसे ज़्यादा पैसा किस योजना में मिलेगा?" },
  { en: "How do I get a Samagra ID?", hi: "समग्र ID कैसे बनवाएँ?" },
  { en: "My payment has not come", hi: "मेरा पैसा नहीं आया" },
];

/* ---------- Who is the question about? ---------- */

const RELATION_WORDS: [RegExp, (p: Person) => boolean][] = [
  [/(बेटे|बेटा|लड़के|लड़का|पुत्र|\bson\b|\bbeta\b|\bbete\b)/i, (p) => p.relation === "son" || (p.relation === "grandchild" && p.profile.gender === "male")],
  [/(बेटी|बेटियों|लड़की|पुत्री|daughter|\bbeti\b)/i, (p) => p.relation === "daughter" || (p.relation === "grandchild" && p.profile.gender === "female")],
  [/(पति|husband|\bpati\b)/i, (p) => (p.relation === "spouse" || p.relation === "self") && p.profile.gender === "male"],
  [/(पत्नी|wife|\bpatni\b)/i, (p) => (p.relation === "spouse" || p.relation === "self") && p.profile.gender === "female"],
  [/(माँ|मां|माता|मम्मी|सास|mother|\bmaa\b)/i, (p) => p.relation === "mother"],
  [/(पिता|पापा|बाबूजी|ससुर|father)/i, (p) => p.relation === "father"],
  [/(बच्चे|बच्चों|बच्चा|बच्ची|children|child|kids)/i, (p) => (p.profile.age ?? 99) < 18],
  [/(दादी|दादा|नानी|नाना|बुज़ुर्ग|बुजुर्ग|grand(mother|father)|elder)/i, (p) => (p.profile.age ?? 0) >= 60],
];

function target(question: string, people: Person[]): { people: Person[]; missing?: Text } {
  if (people.length <= 1) return { people };
  const byName = people.filter((p) => p.name && question.includes(p.name.split(" ")[0]));
  if (byName.length) return { people: byName };
  for (const [re, test] of RELATION_WORDS) {
    if (!re.test(question)) continue;
    const hit = people.filter(test);
    if (hit.length) return { people: hit };
  }
  return { people };
}

/* ---------- Small pieces ---------- */

function best(scheme: Scheme, people: Person[]) {
  return people
    .map((p) => ({ p, r: evaluateScheme(scheme, p.profile) }))
    .sort((a, b) => RANK[a.r.verdict] - RANK[b.r.verdict])[0];
}
const toAnswerScheme = (x: { p: Person; r: MatchResult }, many: boolean): AnswerScheme => ({
  id: x.r.scheme.id,
  name: x.r.scheme.name,
  verdict: x.r.verdict,
  category: x.r.scheme.category,
  for: many && x.p.name ? x.p.name : undefined,
});
const docName = (lang: Lang) => (id: string) => getDocument(id)?.name[lang];

/* ---------- The answer ---------- */

export function answerQuestion(args: {
  question: string;
  lang: Lang;
  people: Person[];
  all: Scheme[];
  pinned?: Scheme;
  /** Schemes already chosen as relevant (e.g. by a language model) — skips intent detection and keyword search. */
  candidates?: Scheme[];
}): Answer {
  const { lang, pinned, all } = args;
  const hi = lang === "hi";
  // One Unicode form: "ड़" typed, spoken or produced by a model must compare equal.
  const q = args.question.normalize("NFC").trim();
  const many = args.people.length > 1;
  const { people } = target(q, args.people);
  const base = (kind: AnswerKind, text: string, extra: Partial<Answer> = {}): Answer => ({
    kind, text, schemes: [], suggestions: [], results: [], resultNames: [], ...extra,
  });
  const pack = (xs: { p: Person; r: MatchResult }[]) => ({
    schemes: xs.map((x) => toAnswerScheme(x, many)),
    results: xs.map((x) => x.r),
    resultNames: xs.map((x) => (many ? x.p.name : undefined)),
  });

  const forced = args.candidates?.length ? args.candidates : null;

  // 1. Conversation: greeting, "who are you", thanks.
  const short = q.split(/\s+/).length <= 6;
  if (!forced && short && /^(नमस्ते|नमस्कार|प्रणाम|राम राम|हेलो|हैलो|हाय|hello|hi|hey|namaste)/i.test(q) && !/योजना|scheme|पेंशन/i.test(q)) {
    return base("smalltalk", hi
      ? "नमस्ते! मैं नागरिक AI हूँ। मैं बता सकता हूँ कि आपके परिवार को कौन सी सरकारी योजनाएँ मिल सकती हैं, कौन से कागज़ चाहिए और आवेदन कहाँ करना है। आप क्या जानना चाहते हैं?"
      : "Namaste! I'm NagrikAI. I can tell you which government schemes your family can get, which papers are needed and where to apply. What would you like to know?", { suggestions: SUGGEST });
  }
  if (!forced && /(आप कौन|तुम कौन|कौन हो|क्या कर सकते|क्या काम|कैसे काम कर|who are you|what are you|what can you do|how do you work)/i.test(q)) {
    return base("smalltalk", hi
      ? "मैं नागरिक AI हूँ — मध्यप्रदेश के परिवारों के लिए सरकारी योजनाओं का सहायक। मैं आधिकारिक नियमों से जाँचकर बताता हूँ कि किस सदस्य को कौन सी योजना मिल सकती है और क्यों, ज़रूरी दस्तावेज़, आवेदन का तरीका, हेल्पलाइन, और समग्र ID या प्रमाण पत्र जैसे काम कैसे करें। मैं सरकारी कार्यालय नहीं हूँ — अंतिम निर्णय विभाग का होता है।"
      : "I'm NagrikAI — a guide to government schemes for families in Madhya Pradesh. Using official rules I tell you which member can get which scheme and why, the documents, how to apply, helplines, and how to do things like getting a Samagra ID or a certificate. I'm not a government office — the department makes the final decision.", { suggestions: SUGGEST });
  }
  if (!forced && short && /(धन्यवाद|शुक्रिया|thanks|thank you|thank u)/i.test(q)) {
    return base("smalltalk", hi ? "आपका स्वागत है! और कुछ पूछना हो तो बताइए।" : "You're welcome! Ask me anything else.", { suggestions: SUGGEST.slice(0, 2) });
  }

  const named = pinned ? [{ scheme: pinned, words: [] as string[] }] : mentionedSchemes(q);

  // 2. Something went wrong with an application or a payment.
  const rejected = /(रिजेक्ट|reject|अस्वीकार|निरस्त|ख़ारिज|खारिज|नामंज़ूर|नामंजूर|मना कर दिया|cancel)/i.test(q);
  const unpaid = /(पैसा|पैसे|किस्त|किश्त|राशि|रुपये|पेंशन|payment|instal?lment|money|paisa|paise|kist)[^.?]{0,40}(नहीं आ|नही आ|नहीं मिल|नही मिल|रुक|बंद हो|अटक|not (received|come|credited|coming)|nahi aa|nhi aa|nahi mil|nhi mil|ruk)/i.test(q);
  if (!forced && (rejected || unpaid)) {
    const s = named[0]?.scheme;
    const x = s ? best(s, people) : undefined;
    const steps = unpaid
      ? hi
        ? ["समग्र e-KYC पूरी है या नहीं देखें (samagra.gov.in)।", "बैंक खाता आधार से जुड़ा और DBT-सक्रिय होना चाहिए — बैंक शाखा में पूछें।", "खाता चालू हो (लंबे समय से बंद खाते में पैसा लौट जाता है)।", s ? `${s.name.hi} के पोर्टल पर अपनी भुगतान स्थिति देखें।` : "योजना के पोर्टल पर अपनी भुगतान स्थिति देखें।"]
        : ["Check that Samagra e-KYC is complete (samagra.gov.in).", "The bank account must be Aadhaar-seeded and DBT-enabled — ask at your branch.", "The account must be active (money bounces from dormant accounts).", s ? `Check your payment status on the ${s.name.en} portal.` : "Check your payment status on the scheme's portal."]
      : hi
        ? ["अस्वीकृति का कारण पूछें — पोर्टल पर या जिस कार्यालय में आवेदन किया था।", "कमी (दस्तावेज़, e-KYC, नाम में अंतर) ठीक करके दोबारा आवेदन करें।", "गलत तरीके से अस्वीकार हुआ हो तो उसी कार्यालय में अपील करें या CM हेल्पलाइन 181 पर शिकायत दर्ज करें।"]
        : ["Ask for the reason — on the portal or at the office where you applied.", "Fix the gap (document, e-KYC, name mismatch) and apply again.", "If it was wrongly rejected, appeal at the same office or file a complaint on CM Helpline 181."];
    const lead = unpaid
      ? hi ? "पैसा न आने के सबसे आम कारण और उपाय:" : "The most common reasons a payment doesn't arrive, and what to do:"
      : hi ? "आवेदन अस्वीकार होने पर यह करें:" : "If your application was rejected:";
    const helpline = s?.helpline ? (hi ? ` ${s.name.hi} हेल्पलाइन: ${s.helpline}.` : ` ${s.name.en} helpline: ${s.helpline}.`) : "";
    const tail = hi ? ` फिर भी समाधान न हो तो CM हेल्पलाइन 181 पर कॉल करें।${helpline}` : ` If it still isn't solved, call CM Helpline 181.${helpline}`;
    const note = s?.intakeClosed && unpaid ? (hi ? ` ध्यान दें: ${s.name.hi} में नए पंजीयन अभी बंद हैं — राशि केवल पहले से पंजीकृत लाभार्थियों को मिलती है।` : ` Note: ${s.name.en} is not taking new registrations — only existing beneficiaries are paid.`) : "";
    return base("problem", `${lead} ${steps.map((t, i) => `${i + 1}) ${t}`).join(" ")}${note}${tail}`, {
      ...(x ? pack([x]) : {}),
      link: s ? { label: hi ? "आधिकारिक पोर्टल" : "Official portal", url: s.applyUrl } : { label: "CM Helpline", url: "https://cmhelpline.mp.gov.in" },
      suggestions: [{ en: "How do I link Aadhaar to my bank account?", hi: "बैंक खाते से आधार कैसे जोड़ें?" }, { en: "How do I do Samagra e-KYC?", hi: "समग्र e-KYC कैसे करें?" }],
    });
  }

  // 3. "How do I…" for things that aren't schemes (Samagra ID, ration card, certificates…).
  if (!pinned && !forced) {
    const art = ARTICLES.find((a) => a.re.test(q));
    if (art) {
      const help = art.helpline ? (hi ? ` हेल्पलाइन: ${art.helpline}.` : ` Helpline: ${art.helpline}.`) : "";
      return base("howto", `${art.title[lang]}: ${art.steps.map((s, i) => `${i + 1}) ${s[lang]}`).join(" ")}${help}`, {
        link: { label: hi ? "आधिकारिक वेबसाइट" : "Official website", url: art.url },
        suggestions: SUGGEST.slice(0, 2),
      });
    }
  }

  // 4. "X और Y में क्या फर्क है?"
  if (!forced && /(फर्क|फ़र्क|अंतर|difference|compare|तुलना|\bvs\b|बेहतर|better)/i.test(q) && named.length >= 2) {
    const first = named[0];
    const second = named.find((n) => n.scheme.id !== first.scheme.id && n.words.some((w) => !first.words.includes(w)));
    if (second) {
      const xs = [best(first.scheme, people), best(second.scheme, people)];
      const line = (x: { p: Person; r: MatchResult }) => {
        const s = x.r.scheme;
        const status = x.r.verdict === "eligible" ? (hi ? "आप पात्र हैं" : "you qualify") : x.r.verdict === "possible" ? (hi ? "पात्र हो सकते हैं" : "you may qualify") : hi ? "अभी पात्र नहीं" : "not eligible now";
        return `${s.name[lang]} — ${s.summary[lang]} ${hi ? "लाभ" : "Benefit"}: ${s.benefit[lang]} (${status}).`;
      };
      return base("compare", `${hi ? "दोनों अलग योजनाएँ हैं।" : "These are two different schemes."} 1) ${line(xs[0])} 2) ${line(xs[1])} ${hi ? "पात्र हों तो दोनों का लाभ साथ में लिया जा सकता है।" : "If you qualify, you can take both."}`, pack(xs));
    }
  }

  // 5. "Which schemes can I get?" / "Which pays the most?"
  if (!forced && (/(सबसे (ज़्यादा|ज्यादा|अधिक|बड़ा)|most|highest|maximum|sabse (jyada|zyada))/i.test(q) || /(कौन.?सी|कौन कौन|क्या.?क्या|कितनी)\s*(सी )?(योजना|लाभ)|(योजना(एँ|ओं)?|लाभ)[^.?]{0,20}(मिल सक|मिलेंगी|मिलेगी|पात्र)|what (all )?(schemes )?can (i|we) get|which schemes/i.test(q))) {
    const xs = all.map((s) => best(s, people)).filter((x) => x.r.verdict === "eligible" && !x.r.scheme.intakeClosed && !x.r.scheme.eventBased)
      .sort((a, b) => value(b.r.scheme) - value(a.r.scheme) || (b.r.scheme.benefit.cover ?? 0) - (a.r.scheme.benefit.cover ?? 0));
    if (xs.length) {
      const top = xs.slice(0, 5);
      const list = top.map((x, i) => `${i + 1}) ${x.r.scheme.name[lang]}${many && x.p.name ? ` (${x.p.name})` : ""} — ${x.r.scheme.benefit[lang]}`).join(" ");
      const lead = hi ? `आपको अभी ${xs.length} योजनाएँ मिल सकती हैं। सबसे ज़्यादा लाभ वाली:` : `You can get ${xs.length} schemes right now. The most valuable:`;
      return base("ranking", `${lead} ${list}`, { ...pack(top.slice(0, 4)), suggestions: [{ en: "Which documents do I need?", hi: "कौन से दस्तावेज़ चाहिए?" }] });
    }
    return base("ranking", hi ? "अभी आपकी जानकारी से कोई पक्की योजना नहीं निकली। कुछ और जानकारी देंगे तो योजनाएँ खुलेंगी — उम्र, काम, राशन कार्ड और परिवार की कमाई बताइए।" : "Nothing is certain yet from what I know. Tell me your age, work, ration card and family income and more schemes will open up.", { suggestions: SUGGEST.slice(2) });
  }

  // 6. A question about a scheme (by name or by need).
  const candidates = forced ?? (pinned ? [pinned, ...searchSchemes(q).filter((x) => x.id !== pinned.id).slice(0, 2)] : named.length ? [...named.map((n) => n.scheme), ...searchSchemes(q)] : searchSchemes(q));
  const seen = new Set<string>();
  const ranked = candidates
    .filter((s) => !seen.has(s.id) && seen.add(s.id))
    .map((s, i) => ({ ...best(s, people), i }))
    // A scheme named in the question stays first; otherwise what the family can get comes first.
    .sort((a, b) => (pinned || named.length ? (a.i === 0 ? -1 : b.i === 0 ? 1 : RANK[a.r.verdict] - RANK[b.r.verdict] || a.i - b.i) : RANK[a.r.verdict] - RANK[b.r.verdict] || a.i - b.i))
    .filter((x, idx) => idx === 0 || x.r.verdict !== "ineligible" || !(pinned || named.length))
    .slice(0, 4);
  if (ranked.length) {
    const who = many && ranked[0].p.name ? (hi ? `${ranked[0].p.name} के लिए: ` : `For ${ranked[0].p.name}: `) : "";
    const more = ranked.length > 1 ? (hi ? " इनसे जुड़ी और योजनाएँ नीचे देखें।" : " See related schemes below.") : "";
    return base("scheme", who + answerRules(q, ranked[0].r, lang, docName(lang)) + more, {
      ...pack(ranked),
      suggestions: [{ en: "Which documents are needed?", hi: "कौन से दस्तावेज़ चाहिए?" }, { en: "How do I apply?", hi: "आवेदन कैसे करूँ?" }],
    });
  }

  // 7. Nothing matched: be useful anyway.
  return base("none", hi
    ? "मुझे इस सवाल का पक्का जवाब नहीं मिला। आप योजना का नाम या अपनी ज़रूरत बताकर पूछ सकते हैं — जैसे पेंशन, इलाज, घर, पढ़ाई, गैस, राशन। किसी भी सरकारी काम में मदद के लिए CM हेल्पलाइन 181 पर कॉल कर सकते हैं।"
    : "I couldn't find a sure answer to that. Try naming the scheme or your need — pension, treatment, house, education, gas, ration. For help with any government service you can call CM Helpline 181.", { suggestions: SUGGEST });
}
