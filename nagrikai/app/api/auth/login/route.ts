import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, MobileSchema, PinSchema } from "@/lib/api";
import { findLogin, verifyPin } from "@/lib/server/db";
import { loginLocked, recordLogin, startSession } from "@/lib/server/session";

const Body = z.object({ mobile: MobileSchema, pin: PinSchema });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { mobile, pin } = parsed.data;
  if (loginLocked(mobile)) return NextResponse.json({ error: { code: "LOCKED", message: "Too many attempts. Try after 15 minutes." } }, { status: 429 });

  const login = findLogin(mobile);
  const ok = !!login && verifyPin(pin, login.pinHash);
  recordLogin(mobile, ok);
  if (!ok) return NextResponse.json({ error: { code: "BAD_LOGIN", message: "Wrong mobile number or PIN" } }, { status: 401 });
  await startSession(login!.memberId);
  return NextResponse.json({ ok: true });
}
