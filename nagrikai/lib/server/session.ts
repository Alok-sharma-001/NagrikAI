import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, deleteSession, sessionMember } from "./db";

const COOKIE = "nagrik_session";

export async function currentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? sessionMember(token) : null;
}

export async function startSession(memberId: string) {
  const { token, expires } = createSession(memberId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(token);
  jar.delete(COOKIE);
}

export const unauthorized = () => NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Please log in" } }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: { code: "FORBIDDEN", message: "Not allowed" } }, { status: 403 });

/* Brute-force protection for 4-digit PINs: 5 wrong tries locks that mobile for 15 minutes. */
const attempts = new Map<string, { fails: number; until: number }>();
export function loginLocked(mobile: string): boolean {
  const a = attempts.get(mobile);
  return !!a && a.fails >= 5 && a.until > Date.now();
}
export function recordLogin(mobile: string, ok: boolean) {
  if (ok) return attempts.delete(mobile);
  const a = attempts.get(mobile);
  const fails = a && a.until > Date.now() ? a.fails + 1 : 1;
  attempts.set(mobile, { fails, until: Date.now() + 15 * 60_000 });
}
