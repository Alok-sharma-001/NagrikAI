import { NextResponse } from "next/server";
import { endOfficerSession } from "@/lib/server/officer";

export async function POST() {
  await endOfficerSession();
  return NextResponse.json({ ok: true });
}
