import { FIELD_NAMES, formatProfileValue, rupees } from "./labels";
import type { Lang, MatchResponse, MatchResult, Profile, ProfileField } from "./types";

/** Template replies used when no LLM is configured or the LLM call fails. */

export function chatReplyRules(lang: Lang, profile: Profile, learned: Partial<Profile>, m: MatchResponse): string {
  const hi = lang === "hi";
  const parts: string[] = [];
  const learnedKeys = Object.keys(learned) as ProfileField[];

  if (learnedKeys.length) {
    const facts = learnedKeys
      .filter((k) => k !== "name")
      .slice(0, 5)
      .map((k) => `${FIELD_NAMES[k][lang]}: ${formatProfileValue(k, learned[k], lang)}`)
      .join(", ");
    const who = profile.name ? (hi ? `${profile.name} जी, ` : `${profile.name}, `) : "";
    parts.push(hi ? `${who}समझ गया — ${facts}।` : `${who}got it — ${facts}.`);
  } else if (!Object.keys(profile).length) {
    parts.push(
      hi
        ? "नमस्ते! अपने बारे में बताइए — उम्र, काम, गाँव या शहर, और परिवार की कमाई।"
        : "Hello! Tell me about yourself — your age, work, village or city, and family income.",
    );
  }

  if (m.eligible.length) {
    const top = m.eligible.slice(0, 3).map((r) => r.scheme.name[lang]).join(hi ? ", " : ", ");
    parts.push(
      hi
        ? `आप अभी ${m.eligible.length} योजनाओं के लिए पात्र हैं, जैसे ${top}।`
        : `You currently qualify for ${m.eligible.length} schemes, including ${top}.`,
    );
    if (m.totals.cashPerYear || m.totals.oneTime) {
      parts.push(
        hi
          ? `इनसे लगभग ${rupees(m.totals.cashPerYear)} सालाना${m.totals.oneTime ? ` और ${rupees(m.totals.oneTime)} तक एकमुश्त` : ""} लाभ मिल सकता है।`
          : `That's about ${rupees(m.totals.cashPerYear)} a year${m.totals.oneTime ? ` plus up to ${rupees(m.totals.oneTime)} one-time` : ""} in benefits.`,
      );
    }
  }
  if (m.askFor[0]) parts.push(m.askFor[0].question[lang]);
  else if (m.eligible.length) parts.push(hi ? "नीचे अपनी योजनाएँ और दस्तावेज़ सूची देखें।" : "See your schemes and document checklist below.");
  return parts.join(" ");
}

export function explainRules(r: MatchResult, lang: Lang): string {
  const hi = lang === "hi";
  const s = r.scheme;
  const join = (xs: { label: { en: string; hi: string } }[]) => xs.map((x) => x.label[lang]).join(hi ? "; " : "; ");
  const out: string[] = [];
  if (r.verdict === "eligible") {
    out.push(hi ? `आप ${s.name.hi} के लिए पात्र हैं क्योंकि: ${join(r.matched)}।` : `You qualify for ${s.name.en} because: ${join(r.matched)}.`);
    out.push(hi ? `लाभ: ${s.benefit.hi}।` : `Benefit: ${s.benefit.en}.`);
  } else if (r.verdict === "possible") {
    out.push(hi ? `आप ${s.name.hi} के लिए पात्र हो सकते हैं। यह जानकारी चाहिए: ${join(r.unknown)}।` : `You may qualify for ${s.name.en}. We still need to know: ${join(r.unknown)}.`);
  } else {
    out.push(hi ? `आप अभी ${s.name.hi} के लिए पात्र नहीं हैं क्योंकि यह शर्त पूरी नहीं होती: ${join(r.failed)}।` : `You don't qualify for ${s.name.en} right now because this condition isn't met: ${join(r.failed)}.`);
    if (s.stateAlternative && s.stateNote) out.push(s.stateNote[lang]);
  }
  if (s.alsoRequired?.length) out.push((hi ? "यह भी ज़रूरी है: " : "Also required: ") + s.alsoRequired.map((x) => x[lang]).join("; ") + (hi ? "।" : "."));
  if (r.verdict !== "ineligible") out.push((hi ? "आवेदन कैसे करें: " : "How to apply: ") + s.howToApply[lang]);
  return out.join(" ");
}

const INTENTS: [RegExp, "documents" | "apply" | "deadline" | "helpline" | "benefit"][] = [
  [/(दस्तावेज़|दस्तावेज|कागज़|कागज|प्रमाण पत्र|document|papers|certificate)/i, "documents"],
  [/(अंतिम तिथि|तारीख|तिथि|कब तक|last date|deadline|date)/i, "deadline"],
  [/(हेल्पलाइन|नंबर|फ़ोन|फोन|कॉल|helpline|phone|call|contact)/i, "helpline"],
  [/(आवेदन|अप्लाई|कैसे मिलेगा|कहाँ|कैसे करूँ|apply|how to get|where)/i, "apply"],
  [/(कितना|कितने|पैसा|रुपये|लाभ|फ़ायदा|फायदा|how much|amount|benefit|money)/i, "benefit"],
];

/** Template answer to a question about one scheme: answers the part asked (documents, how to apply, …). */
export function answerRules(question: string, r: MatchResult, lang: Lang, docName: (id: string) => string | undefined): string {
  const hi = lang === "hi";
  const s = r.scheme;
  const intent = INTENTS.find(([re]) => re.test(question))?.[1];
  const status =
    r.verdict === "eligible"
      ? hi ? `आप ${s.name.hi} के लिए पात्र हैं।` : `You qualify for ${s.name.en}.`
      : r.verdict === "possible"
        ? hi ? `आप ${s.name.hi} के लिए पात्र हो सकते हैं।` : `You may qualify for ${s.name.en}.`
        : hi ? `अभी आप ${s.name.hi} के लिए पात्र नहीं हैं।` : `You don't qualify for ${s.name.en} right now.`;
  switch (intent) {
    case "documents":
      return `${status} ${hi ? "ये दस्तावेज़ चाहिए:" : "Documents needed:"} ${s.documents.map(docName).filter(Boolean).join(", ")}${hi ? "।" : "."}`;
    case "apply":
      return `${status} ${s.howToApply[lang]}`;
    case "deadline":
      return `${status} ${s.deadline.note[lang]}`;
    case "helpline":
      return `${status} ${s.helpline ? (hi ? `हेल्पलाइन नंबर: ${s.helpline}` : `Helpline: ${s.helpline}`) : hi ? "नज़दीकी CSC / ग्राम पंचायत / नगर निगम कार्यालय में संपर्क करें।" : "Contact your nearest CSC / Gram Panchayat / municipal office."}`;
    case "benefit":
      return `${status} ${hi ? "लाभ:" : "Benefit:"} ${s.benefit[lang]}${hi ? "।" : "."}`;
    default:
      return explainRules(r, lang);
  }
}
