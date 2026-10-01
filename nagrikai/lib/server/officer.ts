import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createOfficerSession, officerSessionValid } from "./db";

const COOKIE = "nagrik_officer";
/** Used only when NAGRIK_OFFICER_CODE is not set — i.e. a demo. The login page says so. */
const DEMO_CODE = "181181";

export const officerCodeIsDemo = () => !process.env.NAGRIK_OFFICER_CODE;

export function checkOfficerCode(code: string): boolean {
  const want = Buffer.from(process.env.NAGRIK_OFFICER_CODE || DEMO_CODE);
  const got = Buffer.from(code);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function startOfficerSession() {
  const { token, expires } = createOfficerSession();
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires });
}
export async function endOfficerSession() {
  (await cookies()).delete(COOKIE);
}
export async function isOfficer(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  return !!token && officerSessionValid(token);
}
export const officerOnly = () => NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Officer login required" } }, { status: 401 });
