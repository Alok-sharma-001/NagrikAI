import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, cleanProfile, NameSchema, RelationSchema } from "@/lib/api";
import { splitProfile } from "@/lib/family";
import { deleteMember, getFamily, updateMember } from "@/lib/server/db";
import { currentSession, forbidden, unauthorized } from "@/lib/server/session";

const Body = z.object({
  name: NameSchema.optional(),
  relation: RelationSchema.optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  /** Head only: approve a member who joined with the family code. */
  approve: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Who may edit whom: you can edit yourself; any active member can edit members
 * without their own login (children, elders); only the head approves joiners.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const s = await currentSession();
  if (!s) return unauthorized();
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const target = getFamily(s.familyId)?.members.find((m) => m.id === id);
  if (!target) return NextResponse.json({ error: { code: "NOT_FOUND", message: "No such member" } }, { status: 404 });

  const self = id === s.memberId;
  const canEdit = self || (s.status === "active" && (s.isHead || !target.hasLogin));
  if (!canEdit || (parsed.data.approve && !s.isHead)) return forbidden();

  const profile = parsed.data.profile ? splitProfile(cleanProfile(parsed.data.profile)).member : undefined;
  updateMember(s.familyId, id, {
    name: parsed.data.name,
    relation: self && target.isHead ? undefined : parsed.data.relation,
    profile,
    status: parsed.data.approve ? "active" : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const s = await currentSession();
  if (!s) return unauthorized();
  const { id } = await ctx.params;
  if (!s.isHead || id === s.memberId) return forbidden();
  deleteMember(s.familyId, id);
  return NextResponse.json({ ok: true });
}
