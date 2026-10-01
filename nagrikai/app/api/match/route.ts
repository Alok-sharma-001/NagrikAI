import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, ProfileSchema } from "@/lib/api";
import { match } from "@/lib/match";

const Body = z.object({ profile: ProfileSchema, skip: z.array(z.string()).optional() });

/** Deterministic eligibility — never calls an LLM. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return NextResponse.json(match(parsed.data.profile, { skip: parsed.data.skip as never }));
}
