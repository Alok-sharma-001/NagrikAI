import { NextResponse } from "next/server";
import { getDocument, getScheme } from "@/lib/kb";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const scheme = getScheme(id);
  if (!scheme) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown scheme" } }, { status: 404 });
  return NextResponse.json({ scheme, documents: scheme.documents.map(getDocument).filter(Boolean) });
}
