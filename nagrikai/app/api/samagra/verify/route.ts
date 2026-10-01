import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { findFamilyBySamagra, samagraMemberState } from "@/lib/server/db";
import { verifiedFamily, verifyOtp } from "@/lib/server/samagra";

const Body = z.object({ ticketId: z.string().min(10), otp: z.string().regex(/^\d{6}$/) });

/** Step 3: check the OTP, then release what Samagra already knows so we don't ask it again. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const result = verifyOtp(parsed.data.ticketId, parsed.data.otp);
  if (result !== "ok") {
    const status = result === "wrong" ? 401 : result === "locked" ? 429 : 410;
    return NextResponse.json({ error: { code: result.toUpperCase(), message: `OTP ${result}` } }, { status });
  }
  const vf = verifiedFamily(parsed.data.ticketId)!;
  const self = vf.members.find((m) => m.samagraMemberId === vf.selfMemberId)!;
  const existing = findFamilyBySamagra(vf.familyId);
  const state = existing ? samagraMemberState(existing.id, vf.selfMemberId) : null;
  return NextResponse.json({
    ok: true,
    familyExists: !!existing,
    alreadyHasLogin: !!state?.hasLogin,
    self: { name: self.name, relation: self.relation, profile: { ...self.profile, ...(state?.profile ?? {}) } },
    household: vf.household,
    members: vf.members.map((m) => ({ name: m.name, relation: m.relation, age: m.profile.age, gender: m.profile.gender })),
  });
}
