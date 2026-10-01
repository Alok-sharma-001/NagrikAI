import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, NameSchema, RelationSchema } from "@/lib/api";
import { splitProfile } from "@/lib/family";
import { addMember } from "@/lib/server/db";
import { currentSession, forbidden, unauthorized } from "@/lib/server/session";

const Body = z.object({ name: NameSchema, relation: RelationSchema, profile: z.record(z.string(), z.unknown()) });

/** Add a member who doesn't have their own phone (children, elderly parents). */
export async function POST(req: Request) {
  const s = await currentSession();
  if (!s) return unauthorized();
  if (s.status !== "active") return forbidden();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { member } = splitProfile(cleanProfile(parsed.data.profile));
  const id = addMember({ familyId: s.familyId, name: parsed.data.name, relation: parsed.data.relation, profile: member, status: "active" });
  return NextResponse.json({ ok: true, id });
}
