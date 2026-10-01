import { NextResponse } from "next/server";
import { evaluateFamily } from "@/lib/family";
import { deleteFamily, getBenefitStatuses, getFamily } from "@/lib/server/db";
import { currentSession, endSession, forbidden, unauthorized } from "@/lib/server/session";

/** The logged-in member's family and its full eligibility picture. */
export async function GET() {
  const s = await currentSession();
  if (!s) return unauthorized();
  const family = getFamily(s.familyId)!;
  const me = family.members.find((m) => m.id === s.memberId)!;

  if (me.status === "pending") {
    // Until approved: only their own data, evaluated without the household's facts.
    const solo = { id: family.id, code: "", household: {}, members: [{ ...me, status: "active" as const }] };
    return NextResponse.json({ me: { id: me.id, isHead: false, status: "pending" }, family: { ...solo, code: null }, match: evaluateFamily(solo), statuses: {} });
  }
  return NextResponse.json({ me: { id: me.id, isHead: me.isHead, status: me.status }, family, match: evaluateFamily(family), statuses: getBenefitStatuses(family.id) });
}

/** Head deletes the whole family's data (right to erasure). */
export async function DELETE() {
  const s = await currentSession();
  if (!s) return unauthorized();
  if (!s.isHead) return forbidden();
  deleteFamily(s.familyId);
  await endSession();
  return NextResponse.json({ ok: true });
}
