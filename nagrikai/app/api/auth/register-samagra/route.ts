import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, MobileSchema, PinSchema } from "@/lib/api";
import { splitProfile } from "@/lib/family";
import { attachSamagraLogin, createFamilyFromSamagra, findFamilyBySamagra, getFamily, mobileTaken, samagraMemberState, updateHousehold } from "@/lib/server/db";
import { consumeTicket, verifiedFamily } from "@/lib/server/samagra";
import { startSession } from "@/lib/server/session";

const Body = z.object({
  ticketId: z.string().min(10),
  profile: z.record(z.string(), z.unknown()),
  mobile: MobileSchema,
  pin: PinSchema,
  consent: z.literal(true),
});

/**
 * Register through Samagra: no family code, no approval step.
 *  - First member of the family → the whole family is created from the registry.
 *  - Later members → their existing record simply gets a login.
 * Registry facts (name, age, gender, relation, category, BPL, district) always win over typed answers.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { ticketId, mobile, pin } = parsed.data;
  const vf = verifiedFamily(ticketId);
  if (!vf) return NextResponse.json({ error: { code: "EXPIRED", message: "Verification expired — please verify again" } }, { status: 410 });
  if (mobileTaken(mobile)) return NextResponse.json({ error: { code: "MOBILE_TAKEN", message: "Mobile already registered" } }, { status: 409 });

  const answered = splitProfile(cleanProfile(parsed.data.profile));
  const registrySelf = vf.members.find((m) => m.samagraMemberId === vf.selfMemberId)!;
  const existing = findFamilyBySamagra(vf.familyId);
  let memberId: string | null;
  let created = false;

  if (existing) {
    const state = samagraMemberState(existing.id, vf.selfMemberId);
    if (state?.hasLogin) return NextResponse.json({ error: { code: "ALREADY_REGISTERED", message: "This member is already registered — please log in" } }, { status: 409 });
    memberId = attachSamagraLogin({
      familyId: existing.id,
      samagraMemberId: vf.selfMemberId,
      profile: { ...(state?.profile ?? {}), ...answered.member, ...registrySelf.profile },
      mobile,
      pin,
    });
    // Home facts this member knows and the family hasn't recorded yet (e.g. land) fill the gaps — never overwrite.
    const current = getFamily(existing.id)!.household;
    updateHousehold(existing.id, { ...answered.household, ...current });
  } else {
    const members = vf.members.map((m) => (m.samagraMemberId === vf.selfMemberId ? { ...m, profile: { ...answered.member, ...m.profile } } : m));
    memberId = createFamilyFromSamagra({
      samagraId: vf.familyId,
      household: { ...answered.household, ...vf.household },
      members,
      selfMemberId: vf.selfMemberId,
      mobile,
      pin,
    }).memberId;
    created = true;
  }
  if (!memberId) return NextResponse.json({ error: { code: "FAILED", message: "Could not link this member" } }, { status: 500 });
  consumeTicket(ticketId);
  await startSession(memberId);
  return NextResponse.json({ ok: true, created, members: vf.members.length });
}
