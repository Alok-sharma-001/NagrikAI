import { NextResponse } from "next/server";
import { getFamily } from "@/lib/server/db";
import { currentSession } from "@/lib/server/session";

/** Lightweight "who is logged in" for the site header. */
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ loggedIn: false });
  const me = getFamily(s.familyId)?.members.find((m) => m.id === s.memberId);
  return NextResponse.json({ loggedIn: true, name: me?.name ?? "", isHead: s.isHead });
}
