import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, LangSchema, ProfileSchema } from "@/lib/api";
import { evaluateScheme } from "@/lib/eligibility";
import { getScheme } from "@/lib/kb";
import { explainLLM, llmEnabled } from "@/lib/llm";
import { explainRules } from "@/lib/reply";

const Body = z.object({ schemeId: z.string(), profile: ProfileSchema, lang: LangSchema });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { schemeId, profile, lang } = parsed.data;
  const scheme = getScheme(schemeId);
  if (!scheme) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown scheme" } }, { status: 404 });

  const result = evaluateScheme(scheme, profile);
  if (llmEnabled()) {
    try {
      return NextResponse.json({ text: await explainLLM(result, profile, lang), verdict: result.verdict, mode: "llm" });
    } catch (e) {
      console.warn("LLM explain failed, using template:", (e as Error).message);
    }
  }
  return NextResponse.json({ text: explainRules(result, lang), verdict: result.verdict, mode: "rules" });
}
