import { NextResponse } from "next/server";
import { SCHEMES } from "@/lib/kb";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const category = url.searchParams.get("category");
  const schemes = SCHEMES.filter(
    (s) =>
      (!category || s.category === category) &&
      (!q || [s.name.en, s.name.hi, s.summary.en, s.summary.hi, s.ministry].some((t) => t.toLowerCase().includes(q))),
  ).map(({ id, name, category, summary, benefit, ministry }) => ({ id, name, category, summary, benefit, ministry }));
  return NextResponse.json({ schemes });
}
