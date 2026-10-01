import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, MobileSchema, NameSchema, PinSchema } from "@/lib/api";
import { splitProfile } from "@/lib/family";
import { createFamily, mobileTaken } from "@/lib/server/db";
import { startSession } from "@/lib/server/session";

const Body = z.object({
  name: NameSchema,
  profile: z.record(z.string(), z.unknown()),
  mobile: MobileSchema,
  pin: PinSchema,
  consent: z.literal(true),
});

/** First person of a family registers: creates the family and becomes its head. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { name, mobile, pin } = parsed.data;
  if (mobileTaken(mobile)) return NextResponse.json({ error: { code: "MOBILE_TAKEN", message: "Mobile already registered" } }, { status: 409 });

  const { household, member } = splitProfile(cleanProfile(parsed.data.profile));
  const { family, memberId } = createFamily({ household, head: { name, profile: member, mobile, pin } });
  await startSession(memberId);
  return NextResponse.json({ ok: true, familyCode: family.code });
}
