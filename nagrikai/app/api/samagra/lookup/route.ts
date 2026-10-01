import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { findFamilyBySamagra } from "@/lib/server/db";
import { isDemoRegistry, lookupFamily } from "@/lib/server/samagra";

const Body = z.object({ familyId: z.string().regex(/^\d{8}$/, "8-digit Samagra family ID") });

/** Step 1: family ID → members with masked names (full details only after OTP). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const fam = lookupFamily(parsed.data.familyId);
  if (!fam) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Samagra family ID not found" } }, { status: 404 });
  return NextResponse.json({ ...fam, alreadyRegistered: !!findFamilyBySamagra(fam.familyId), demo: isDemoRegistry });
}
