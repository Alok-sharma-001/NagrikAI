import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, LangSchema, ProfileSchema } from "@/lib/api";
import { answerQuestion } from "@/lib/assistant";
import { extractProfileRules, parseYesNo } from "@/lib/extract";
import { SCHEMES } from "@/lib/kb";
import { chatReplyLLM, extractProfileLLM, llmEnabled } from "@/lib/llm";
import { match } from "@/lib/match";
import { mergeProfile } from "@/lib/profile";
import { QUESTIONS } from "@/lib/questions";
import { tooMany } from "@/lib/server/ratelimit";
import { chatReplyRules } from "@/lib/reply";
import type { Profile, ProfileField } from "@/lib/types";

const Body = z.object({
  lang: LangSchema,
  profile: ProfileSchema.default({}),
  message: z.string().max(2000),
  /** A quick-reply chip tap: set this field directly, no parsing needed. */
  answer: z.object({ field: z.string(), value: z.unknown() }).optional(),
  /** Field the assistant asked about last, so "नहीं" / "yes" can be mapped to it. */
  lastAsked: z.string().optional(),
  skip: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const limited = tooMany(req, "chat", 30);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { lang, profile, message } = parsed.data;
  const lastAsked = parsed.data.lastAsked && parsed.data.lastAsked in QUESTIONS ? (parsed.data.lastAsked as ProfileField) : undefined;
  let mode: "llm" | "rules" = llmEnabled() ? "llm" : "rules";

  // 0. A question rather than a description of oneself ("समग्र ID कैसे बनवाएँ?") goes to the assistant.
  const isChipOrYesNo = !!parsed.data.answer || (parseYesNo(message) !== null && message.trim().split(/\s+/).length <= 3);
  if (!isChipOrYesNo && Object.keys(extractProfileRules(message)).length === 0) {
    const a = answerQuestion({ question: message, lang, people: [{ profile }], all: SCHEMES });
    if (a.kind !== "none" && a.kind !== "scheme") {
      return NextResponse.json({ reply: a.text, profile, extracted: {}, match: match(profile, { skip: parsed.data.skip as ProfileField[] | undefined }), mode: "rules" });
    }
  }

  // 1. Understand the message.
  let learned: Partial<Profile> = {};
  const yn = parseYesNo(message);
  const askedYesNo = lastAsked && QUESTIONS[lastAsked]?.options.some((o) => typeof o.value === "boolean");
  const answer = parsed.data.answer;
  if (answer && answer.field in QUESTIONS) {
    learned = { [answer.field]: answer.value } as Partial<Profile>;
  } else if (yn !== null && askedYesNo && message.trim().split(/\s+/).length <= 3) {
    learned = { [lastAsked!]: yn };
  } else if (mode === "llm") {
    try {
      learned = await extractProfileLLM(message, lastAsked);
    } catch (e) {
      console.warn("LLM extraction failed, using rules:", (e as Error).message);
      mode = "rules";
    }
  }
  if (mode === "rules" && !Object.keys(learned).length) learned = extractProfileRules(message);
  // Validate whatever was learned the same way as client input.
  learned = cleanProfile(learned) as Partial<Profile>;

  // 2. Decide eligibility (rules only).
  const merged = mergeProfile(profile, learned);
  const m = match(merged, { skip: parsed.data.skip as ProfileField[] | undefined });

  // 3. Explain.
  let reply: string;
  if (mode === "llm") {
    try {
      reply = await chatReplyLLM({ lang, profile: merged, learned, match: m });
    } catch (e) {
      console.warn("LLM reply failed, using template:", (e as Error).message);
      reply = chatReplyRules(lang, merged, learned, m);
      mode = "rules";
    }
  } else reply = chatReplyRules(lang, merged, learned, m);

  return NextResponse.json({ reply, profile: merged, extracted: learned, match: m, mode });
}
