import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, MobileSchema, NameSchema, PinSchema, RelationSchema } from "@/lib/api";
import { splitProfile } from "@/lib/family";
import { addMember, findFamilyByCode, mobileTaken } from "@/lib/server/db";
import { startSession } from "@/lib/server/session";

const Body = z.object({
  code: z.string().trim().min(4).max(10),
  name: NameSchema,
  relation: RelationSchema,
  profile: z.record(z.string(), z.unknown()),
  mobile: MobileSchema,
  pin: PinSchema,
  consent: z.literal(true),
});

/**
 * A family member registers on their own phone using the family code.
 * They join as "pending" and see the family only after the head approves,
 * so a leaked code can't expose a family's data.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const d = parsed.data;
  const fam = findFamilyByCode(d.code);
  if (!fam) return NextResponse.json({ error: { code: "BAD_CODE", message: "Family code not found" } }, { status: 404 });
  if (mobileTaken(d.mobile)) return NextResponse.json({ error: { code: "MOBILE_TAKEN", message: "Mobile already registered" } }, { status: 409 });

  const { member } = splitProfile(cleanProfile(d.profile)); // household facts come from the family, not the joiner
  const memberId = addMember({ familyId: fam.id, name: d.name, relation: d.relation, profile: member, status: "pending", login: { mobile: d.mobile, pin: d.pin } });
  await startSession(memberId);
  return NextResponse.json({ ok: true, status: "pending" });
}
