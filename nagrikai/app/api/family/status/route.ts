import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { getScheme } from "@/lib/kb";
import { getFamily, setBenefitStatus } from "@/lib/server/db";
import { currentSession, forbidden, unauthorized } from "@/lib/server/session";

const Body = z.object({
  schemeId: z.string(),
  /** "" for a family-level scheme. */
  memberId: z.string(),
  status: z.enum(["receiving", "applied", "rejected"]).nullable(),
});

/** Citizen marks a scheme as receiving / applied / rejected (or clears it). */
export async function PUT(req: Request) {
  const s = await currentSession();
  if (!s) return unauthorized();
  if (s.status !== "active") return forbidden();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { schemeId, memberId, status } = parsed.data;
  if (!getScheme(schemeId)) return badRequest("Unknown scheme");
  if (memberId && !getFamily(s.familyId)!.members.some((m) => m.id === memberId)) return forbidden();
  setBenefitStatus(s.familyId, schemeId, memberId, status);
  return NextResponse.json({ ok: true });
}
