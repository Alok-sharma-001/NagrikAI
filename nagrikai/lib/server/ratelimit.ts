import "server-only";
import { NextResponse } from "next/server";

/** Small fixed-window limiter per client IP. Enough to stop one client hammering an endpoint. */
const hits = new Map<string, { n: number; reset: number }>();

export function tooMany(req: Request, bucket: string, max: number, windowMs = 60_000): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return null;
  }
  if (++h.n <= max) return null;
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message: "Too many requests — please wait a minute." } },
    { status: 429, headers: { "Retry-After": String(Math.ceil((h.reset - now) / 1000)) } },
  );
}
