import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { generateDemoFamilies } from "@/lib/demo";
import { clearDemoFamilies, insertDemoFamilies } from "@/lib/server/db";
import { isOfficer, officerOnly } from "@/lib/server/officer";

/** Load or remove the fictional demo families (flagged in the database; real families are never touched). */
export async function POST(req: Request) {
  if (!(await isOfficer())) return officerOnly();
  const parsed = z.object({ action: z.enum(["seed", "clear"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const removed = clearDemoFamilies();
  if (parsed.data.action === "clear") return NextResponse.json({ ok: true, removed });
  const families = generateDemoFamilies(240);
  insertDemoFamilies(families);
  return NextResponse.json({ ok: true, added: families.length });
}
