import { rowsToCsv, summarize } from "@/lib/officer";
import { allFamilies } from "@/lib/server/db";
import { isOfficer, officerOnly } from "@/lib/server/officer";

/** CSV of every unclaimed benefit (no names) — the call list for the next camp. */
export async function GET(req: Request) {
  if (!(await isOfficer())) return officerOnly();
  const p = new URL(req.url).searchParams;
  const scheme = p.get("scheme");
  const { rows } = summarize(allFamilies(), p.get("district") || undefined);
  const csv = rowsToCsv(scheme ? rows.filter((r) => r.schemeId === scheme) : rows);
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nagrikai-gap-${scheme ?? "all"}.csv"` },
  });
}
