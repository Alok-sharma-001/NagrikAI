import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { geminiJson, geminiText, type GeminiSchema } from "./gemini";
import { rupees } from "./labels";
import type { Lang, MatchResponse, MatchResult, Profile, ProfileField } from "./types";
import { OCCUPATIONS, STUDY_LEVELS } from "./types";

/**
 * The LLM does exactly two jobs:
 *   1. turn free-form speech/text into structured profile fields;
 *   2. rephrase results the rules engine ALREADY decided, in simple language.
 * It never decides eligibility. Every function here may throw — callers fall
 * back to the rule-based path.
 */

/** Which language-model service is configured. Gemini wins if both keys are present. */
export function llmProvider(): "gemini" | "anthropic" | null {
  if (process.env.NAGRIK_LLM === "off") return null;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  return null;
}
export const llmEnabled = () => llmProvider() !== null;

const MODEL = process.env.NAGRIK_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 }));

// Shared request options: low effort keeps chat snappy; server-side fallback
// re-runs the request on another model if this one declines.
const COMMON = {
  model: MODEL,
  output_config: { effort: "low" as const },
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

const n = <T extends z.ZodType>(t: T) => t.nullable();
const ExtractSchema = z.object({
  name: n(z.string()),
  age: n(z.number().int()),
  gender: n(z.enum(["male", "female", "transgender"])),
  state: n(z.string()),
  area: n(z.enum(["rural", "urban"])),
  annualIncome: n(z.number()),
  category: n(z.enum(["general", "obc", "sc", "st", "ews"])),
  isMinority: n(z.boolean()),
  maritalStatus: n(z.enum(["single", "married", "widowed", "divorced"])),
  occupation: n(z.enum(OCCUPATIONS)),
  isBPL: n(z.boolean()),
  isDisabled: n(z.boolean()),
  disabilityPercent: n(z.number()),
  landHectares: n(z.number()),
  ownsPuccaHouse: n(z.boolean()),
  hasLpgConnection: n(z.boolean()),
  hasToilet: n(z.boolean()),
  hasBankAccount: n(z.boolean()),
  isIncomeTaxPayer: n(z.boolean()),
  isGovtEmployee: n(z.boolean()),
  isEpfoMember: n(z.boolean()),
  isPregnantOrLactating: n(z.boolean()),
  hasChildUnder6: n(z.boolean()),
  hasSchoolChildren: n(z.boolean()),
  hasGirlChildUnder10: n(z.boolean()),
  isStudent: n(z.boolean()),
  studyLevel: n(z.enum(STUDY_LEVELS)),
  wantsToStartBusiness: n(z.boolean()),
  breadwinnerDiedRecently: n(z.boolean()),
});

const EXTRACT_SYSTEM = `You extract facts about an Indian citizen from what they say (Hindi, English or Hinglish) to check government-scheme eligibility.
Rules:
- Only fill a field when the user clearly stated or unambiguously implied it. Otherwise use null. Never guess.
- annualIncome is total HOUSEHOLD income per YEAR in rupees (convert monthly × 12; "दस हज़ार महीना" → 120000).
- landHectares: 1 acre = 0.4047 ha; 1 bigha ≈ 0.25 ha.
- isBPL = true if they mention a BPL, Antyodaya (AAY), priority-household or "गरीबी रेखा" ration card.
- hasSchoolChildren = a child aged 6–14 attending school. hasChildUnder6 = a child younger than 6.
- A widow is maritalStatus "widowed" and gender "female".
- breadwinnerDiedRecently = the family's main earner died within about the last year.
- If the assistant just asked about one field and the user answers briefly ("हाँ", "नहीं", "no"), set that field.`;

/** The same fields as ExtractSchema, in Gemini's schema dialect (every field nullable). */
const GEMINI_EXTRACT: GeminiSchema = (() => {
  const str = (e?: readonly string[]): GeminiSchema => ({ type: "STRING", nullable: true, ...(e ? { enum: [...e] } : {}) });
  const num: GeminiSchema = { type: "NUMBER", nullable: true };
  const bool: GeminiSchema = { type: "BOOLEAN", nullable: true };
  const properties: Record<string, GeminiSchema> = {
    name: str(), age: { type: "INTEGER", nullable: true }, gender: str(["male", "female", "transgender"]), state: str(), area: str(["rural", "urban"]),
    annualIncome: num, category: str(["general", "obc", "sc", "st", "ews"]), isMinority: bool,
    maritalStatus: str(["single", "married", "widowed", "divorced"]), occupation: str(OCCUPATIONS), isBPL: bool, isDisabled: bool,
    disabilityPercent: num, landHectares: num, ownsPuccaHouse: bool, hasLpgConnection: bool, hasToilet: bool, hasBankAccount: bool,
    isIncomeTaxPayer: bool, isGovtEmployee: bool, isEpfoMember: bool, isPregnantOrLactating: bool, hasChildUnder6: bool,
    hasSchoolChildren: bool, hasGirlChildUnder10: bool, isStudent: bool, studyLevel: str(STUDY_LEVELS), wantsToStartBusiness: bool,
    breadwinnerDiedRecently: bool,
  };
  return { type: "OBJECT", properties, required: Object.keys(properties) };
})();

export async function extractProfileLLM(text: string, lastAsked?: ProfileField): Promise<Partial<Profile>> {
  const context = lastAsked ? `The assistant's last question was about the field "${lastAsked}".\n\n` : "";
  if (llmProvider() === "gemini") {
    const raw = await geminiJson(EXTRACT_SYSTEM, `${context}User said:\n"""${text}"""`, GEMINI_EXTRACT);
    const out: Partial<Profile> = {};
    for (const [k, v] of Object.entries(raw)) if (v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
    return out; // validated field by field by the caller (cleanProfile)
  }
  const res = await getClient().beta.messages.parse({
    ...COMMON,
    max_tokens: 2000,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: `${context}User said:\n"""${text}"""` }],
    output_config: { ...COMMON.output_config, format: betaZodOutputFormat(ExtractSchema) },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("extraction unavailable");
  const out: Partial<Profile> = {};
  for (const [k, v] of Object.entries(res.parsed_output)) if (v !== null) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** Compact, factual view of results for grounding the LLM. */
function groundingFacts(m: MatchResponse, lang: Lang) {
  const line = (r: MatchResult) =>
    `- ${r.scheme.name[lang]} (${r.scheme.benefit[lang]})${r.scheme.intakeClosed ? " [NEW REGISTRATIONS CLOSED — only already-registered people are paid]" : ""}${r.scheme.eventBased ? ` [${r.scheme.eventBased[lang]}]` : ""}; reasons: ${r.matched.map((x) => x.label[lang]).join("; ") || "—"}`;
  return [
    `ELIGIBLE (${m.eligible.length}):`,
    ...m.eligible.slice(0, 12).map(line),
    `POSSIBLY ELIGIBLE, needs more info (${m.possible.length}): ${m.possible.slice(0, 8).map((r) => r.scheme.name[lang]).join(", ")}`,
    `TOTALS: direct benefits ≈ ${rupees(m.totals.cashPerYear)}/year, one-time ≈ ${rupees(m.totals.oneTime)}, insurance/health cover up to ${rupees(m.totals.cover)}`,
    `NEXT QUESTION TO ASK: ${m.askFor[0]?.question[lang] ?? "none"}`,
  ].join("\n");
}

/** Mixed-script garbage ("नजदीکی", "नजदीki") sometimes slips out of fast models — never show it. */
const garbled = (t: string) => /[\u0600-\u06FF]/.test(t) || /[\u0900-\u097F][a-z]|[a-z][\u0900-\u097F]/i.test(t);

async function generate(system: string, user: string): Promise<string> {
  if (llmProvider() === "gemini") {
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await geminiText(system, user);
      if (!garbled(text)) return text;
    }
    throw new Error("garbled output"); // caller falls back to the rules answer
  }
  const res = await getClient().beta.messages.create({
    ...COMMON,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("refused");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  if (!text) throw new Error("empty");
  return text;
}

const STYLE = (lang: Lang) =>
  lang === "hi"
    ? "Reply in simple, warm, spoken Hindi (Devanagari) that a person with low literacy understands when read aloud. No markdown, no bullet symbols, no English jargon. Do not open with a greeting unless the citizen greeted you, and do not use kinship words like बहन / भाई — say आप. Write every amount, age, phone number and web address in digits exactly as given in the facts (₹600, 181) — never spell numbers out in words."
    : "Reply in simple, warm, plain English that reads well aloud. No markdown, no bullet symbols. Do not open with a greeting unless the citizen greeted you. Write every amount, age, phone number and web address in digits exactly as given in the facts — never spell numbers out.";

const GROUNDING_RULES = `Never promise that money or a benefit WILL come — say the person "qualifies" / "can apply" / "may get". If a scheme is marked NEW REGISTRATIONS CLOSED, say clearly that only already-registered beneficiaries are being paid and new people cannot join right now. Use ONLY the facts given below. Do not add schemes, amounts, criteria, dates or phone numbers that are not in the facts. Do not say anyone is eligible for something not listed as ELIGIBLE. Eligibility has already been decided by an official-rules engine — you only explain it.`;

export async function chatReplyLLM(args: {
  lang: Lang;
  profile: Profile;
  learned: Partial<Profile>;
  match: MatchResponse;
}): Promise<string> {
  const { lang, profile, learned, match } = args;
  return generate(
    `You are NagrikAI, a friendly government-benefits helper for Indian citizens. ${STYLE(args.lang)}
${GROUNDING_RULES}
Write at most 4 short sentences: (1) acknowledge what you understood, (2) say how many schemes they qualify for and name the top 2–3 with their benefit, (3) ask the NEXT QUESTION exactly once if there is one. Address them by name if known.`,
    `PROFILE: ${JSON.stringify(profile)}\nJUST LEARNED: ${JSON.stringify(learned)}\n\n${groundingFacts(match, lang)}`,
  );
}

export async function explainLLM(r: MatchResult, profile: Profile, lang: Lang): Promise<string> {
  const s = r.scheme;
  const facts = [
    `SCHEME: ${s.name[lang]} — ${s.summary[lang]}`,
    `BENEFIT: ${s.benefit[lang]}`,
    `VERDICT: ${r.verdict}`,
    `CRITERIA MET: ${r.matched.map((x) => x.label[lang]).join("; ") || "—"}`,
    `CRITERIA NOT MET: ${r.failed.map((x) => x.label[lang]).join("; ") || "—"}`,
    `STILL UNKNOWN: ${r.unknown.map((x) => x.label[lang]).join("; ") || "—"}`,
    `ALSO REQUIRED (checked by the office): ${(s.alsoRequired ?? []).map((x) => x[lang]).join("; ") || "—"}`,
    `HOW TO APPLY: ${s.howToApply[lang]}`,
    s.intakeClosed ? "NEW REGISTRATIONS CLOSED: yes — only people already registered are paid; a new applicant cannot get this now." : "",
    s.stateNote ? `STATE NOTE: ${s.stateNote[lang]}` : "",
  ].join("\n");
  return generate(
    `You are NagrikAI. ${STYLE(lang)}\n${GROUNDING_RULES}\nIn at most 5 short sentences explain why this person does or does not qualify, what they get, and the first step to apply. If not eligible and there is a STATE NOTE, mention it kindly.`,
    `PROFILE: ${JSON.stringify(profile)}\n\n${facts}`,
  );
}

/** Answer a free question about schemes, grounded on the matched scheme records and verdicts. */
/**
 * `verified` is the answer the rules engine already produced (how-to steps, troubleshooting,
 * ranking…). The model may rephrase and combine it with the scheme facts, but adds nothing new.
 */
export async function askLLM(question: string, results: MatchResult[], profile: Profile, lang: Lang, forNames: (string | undefined)[] = [], verified = ""): Promise<string> {
  const facts = results
    .map((r, i) =>
      [
        `SCHEME: ${r.scheme.name[lang]} — ${r.scheme.summary[lang]}`,
        forNames[i] ? `  VERDICT IS FOR FAMILY MEMBER: ${forNames[i]}` : "",
        `  BENEFIT: ${r.scheme.benefit[lang]}`,
        `  VERDICT FOR THIS PERSON: ${r.verdict}; met: ${r.matched.map((x) => x.label[lang]).join("; ") || "—"}; not met: ${r.failed.map((x) => x.label[lang]).join("; ") || "—"}; unknown: ${r.unknown.map((x) => x.label[lang]).join("; ") || "—"}`,
        `  ALSO REQUIRED: ${(r.scheme.alsoRequired ?? []).map((x) => x[lang]).join("; ") || "—"}`,
        `  HOW TO APPLY: ${r.scheme.howToApply[lang]}`,
        `  DEADLINE: ${r.scheme.deadline.note[lang]}`,
        r.scheme.intakeClosed ? "  NEW REGISTRATIONS CLOSED: yes — only people already registered are paid; a new applicant cannot get this now." : "",
        r.scheme.eventBased ? `  PAID ONLY ON AN EVENT: ${r.scheme.eventBased[lang]}` : "",
        `  HELPLINE: ${r.scheme.helpline ?? "nearest CSC / Gram Panchayat"}`,
        r.scheme.stateNote ? `  STATE NOTE: ${r.scheme.stateNote[lang]}` : "",
      ].join("\n"),
    )
    .join("\n\n");
  return generate(
    `You are NagrikAI, a government-benefits helper. ${STYLE(lang)}
${GROUNDING_RULES}
Answer the citizen's question in at most 6 short sentences using only the VERIFIED ANSWER and the SCHEME facts. If the facts don't answer it, say you don't have that information and give the scheme's helpline or "nearest CSC". Mention whether they qualify using the VERDICT.`,
    `PROFILE: ${JSON.stringify(profile)}\n\nQUESTION: ${question}\n\nVERIFIED ANSWER (keep every step, number and phone number in it): ${verified || "—"}\n\n${facts || "NO MATCHING SCHEMES"}`,
  );
}

/**
 * Hinglish ("ghar banane ke liye paisa") → Devanagari Hindi, so the rules engine's
 * Hindi keyword search can understand it. Meaning is preserved, nothing is added.
 */
export async function toDevanagariLLM(question: string): Promise<string> {
  const out = await generate(
    "Rewrite the user's message in natural Hindi written in Devanagari script. Keep the meaning, names, numbers and scheme names exactly; do not answer it, do not add anything. Output only the rewritten message.",
    question,
  );
  return out.replace(/^["“”']+|["“”']+$/g, "").trim();
}

/**
 * Retrieval help: when keyword search finds nothing, the model picks which schemes a
 * question is about from the catalogue ("बुढ़ापे में सहारा चाहिए" → old-age pension).
 * It only SELECTS ids — whether the person qualifies is still decided by the rules engine.
 */
export async function pickSchemesLLM(question: string, catalogue: { id: string; name: string; summary: string }[]): Promise<string[]> {
  if (llmProvider() !== "gemini") return []; // only wired for Gemini's JSON mode
  const list = catalogue.map((c) => `${c.id} | ${c.name} | ${c.summary}`).join("\n");
  const raw = await geminiJson(
    "You match a citizen's question to government schemes. From the catalogue, return the ids of up to 4 schemes that are clearly relevant to what the person needs. If the question is not about welfare schemes, benefits or government help at all (weather, politics, general knowledge), return an empty list. Never invent an id.",
    `QUESTION: ${question}\n\nCATALOGUE (id | name | what it is):\n${list}`,
    { type: "OBJECT", properties: { schemeIds: { type: "ARRAY", items: { type: "STRING" } } }, required: ["schemeIds"] },
  );
  const known = new Set(catalogue.map((c) => c.id));
  return (Array.isArray(raw.schemeIds) ? raw.schemeIds : []).filter((x): x is string => typeof x === "string" && known.has(x)).slice(0, 4);
}
