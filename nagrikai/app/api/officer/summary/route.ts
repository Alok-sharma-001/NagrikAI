import { NextResponse } from "next/server";
import { summarize } from "@/lib/officer";
import { allFamilies, listFeedback } from "@/lib/server/db";
import { isOfficer, officerOnly } from "@/lib/server/officer";

/** Saturation picture across all registered families — aggregates only. */
export async function GET(req: Request) {
  if (!(await isOfficer())) return officerOnly();
  const district = new URL(req.url).searchParams.get("district") || undefined;
  const { summary } = summarize(allFamilies(), district);
  return NextResponse.json({ ...summary, feedback: listFeedback(20) });
}
