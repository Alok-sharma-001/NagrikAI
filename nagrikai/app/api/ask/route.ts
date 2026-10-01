import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, LangSchema } from "@/lib/api";
import { answerQuestion, type Person } from "@/lib/assistant";
import { memberProfile } from "@/lib/family";
import { getScheme, SCHEMES } from "@/lib/kb";
import { askLLM, llmEnabled, pickSchemesLLM, toDevanagariLLM } from "@/lib/llm";
import { getFamily } from "@/lib/server/db";
import { tooMany } from "@/lib/server/ratelimit";
import { currentSession } from "@/lib/server/session";
import type { Profile } from "@/lib/types";

const Body = z.object({
  question: z.string().trim().min(1).max(1000),
  lang: LangSchema,
  schemeId: z.string().optional(),
  memberId: z.string().optional(),
  /** Guests (not registered) send their profile; registered users' profiles are loaded server-side. */
  profile: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const limited = tooMany(req, "ask", 30);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { question, lang, schemeId, memberId } = parsed.data;

  // Whose eligibility? A chosen member, the whole family, or a guest profile.
  let people: Person[] = [{ profile: cleanProfile(parsed.data.profile ?? {}) as Profile }];
  const s = await currentSession();
  if (s && s.status === "active") {
    const family = getFamily(s.familyId)!;
    const active = family.members.filter((m) => m.status === "active");
    const chosen = memberId ? active.find((m) => m.id === memberId) : undefined;
    people = (chosen ? [chosen] : active).map((m) => ({ id: m.id, name: m.name, relation: m.relation, profile: memberProfile(family, m) }));
  }

  // Roman-script Hindi is first rewritten in Devanagari (AI mode only) so the Hindi keyword search understands it.
  let understood = question;
  if (llmEnabled() && /[a-z]{3,}/i.test(question) && !/[\u0900-\u097F]/.test(question) && lang === "hi") {
    understood = await toDevanagariLLM(question).catch(() => question);
  }

  // The rules-based answer is always computed: it is the reply in rules mode and the grounding in AI mode.
  const pinned = schemeId ? getScheme(schemeId) : undefined;
  let a = answerQuestion({ question: understood, lang, people, all: SCHEMES, pinned });
  if (a.kind === "none" && understood !== question) a = answerQuestion({ question, lang, people, all: SCHEMES, pinned });

  if (llmEnabled()) {
    try {
      // Keyword search found nothing: let the model choose relevant schemes; the rules still judge eligibility.
      if (a.kind === "none" && !pinned) {
        const ids = await pickSchemesLLM(understood, SCHEMES.map((x) => ({ id: x.id, name: x.name.en, summary: x.summary.en })));
        const picked = ids.map(getScheme).filter((x): x is NonNullable<typeof x> => !!x);
        if (picked.length) a = answerQuestion({ question: understood, lang, people, all: SCHEMES, candidates: picked });
      }
      // "I don't know" is returned as written — a model must not embroider it.
      if (a.kind === "none") return NextResponse.json({ kind: a.kind, schemes: a.schemes, link: a.link, suggestions: a.suggestions, text: a.text, mode: "llm" });
      const text = await askLLM(question, a.results, people[0].profile, lang, a.resultNames, a.text);
      return NextResponse.json({ kind: a.kind, schemes: a.schemes, link: a.link, suggestions: a.suggestions, text, mode: "llm" });
    } catch (e) {
      console.warn("LLM ask failed, using rules answer:", (e as Error).message);
    }
  }
  return NextResponse.json({ kind: a.kind, schemes: a.schemes, link: a.link, suggestions: a.suggestions, text: a.text, mode: "rules" });
}
