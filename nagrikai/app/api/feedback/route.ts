import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { getScheme } from "@/lib/kb";
import { addFeedback, getFamily } from "@/lib/server/db";
import { tooMany } from "@/lib/server/ratelimit";
import { currentSession } from "@/lib/server/session";

const Body = z.object({ schemeId: z.string(), note: z.string().trim().min(3).max(500) });

/** "This information is wrong" — goes to the officer dashboard so the scheme record gets rechecked. */
export async function POST(req: Request) {
  const limited = tooMany(req, "feedback", 5, 10 * 60_000);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  if (!getScheme(parsed.data.schemeId)) return badRequest("Unknown scheme");
  const s = await currentSession();
  const district = s ? getFamily(s.familyId)?.household.district : undefined;
  addFeedback(parsed.data.schemeId, district, parsed.data.note);
  return NextResponse.json({ ok: true });
}
