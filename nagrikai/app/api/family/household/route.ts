import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile } from "@/lib/api";
import { splitProfile } from "@/lib/family";
import { getFamily, updateHousehold } from "@/lib/server/db";
import { currentSession, forbidden, unauthorized } from "@/lib/server/session";

const Body = z.object({ household: z.record(z.string(), z.unknown()), replace: z.boolean().optional() });

/** Any active member can update facts about the home (they're shared). */
export async function PATCH(req: Request) {
  const s = await currentSession();
  if (!s) return unauthorized();
  if (s.status !== "active") return forbidden();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { household } = splitProfile(cleanProfile(parsed.data.household));
  const current = getFamily(s.familyId)!.household;
  updateHousehold(s.familyId, parsed.data.replace ? household : { ...current, ...household });
  return NextResponse.json({ ok: true });
}
