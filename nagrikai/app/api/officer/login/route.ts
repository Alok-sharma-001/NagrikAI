import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { checkOfficerCode, isOfficer, officerCodeIsDemo, startOfficerSession } from "@/lib/server/officer";
import { tooMany } from "@/lib/server/ratelimit";

/** Is an officer logged in, and is this deployment using the demo access code? */
export async function GET() {
  return NextResponse.json({ loggedIn: await isOfficer(), demoCode: officerCodeIsDemo() });
}

export async function POST(req: Request) {
  const limited = tooMany(req, "officer-login", 8, 15 * 60_000);
  if (limited) return limited;
  const parsed = z.object({ code: z.string().min(4).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  if (!checkOfficerCode(parsed.data.code)) return NextResponse.json({ error: { code: "BAD_CODE", message: "Wrong access code" } }, { status: 401 });
  await startOfficerSession();
  return NextResponse.json({ ok: true });
}
