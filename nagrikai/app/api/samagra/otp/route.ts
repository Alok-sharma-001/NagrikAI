import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest } from "@/lib/api";
import { sendOtp } from "@/lib/server/samagra";

const Body = z.object({ familyId: z.string().regex(/^\d{8}$/), memberId: z.string().regex(/^\d{9}$/) });

/** Step 2: send an OTP to the mobile registered in Samagra for the chosen member. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const sent = sendOtp(parsed.data.familyId, parsed.data.memberId);
  if (!sent) return NextResponse.json({ error: { code: "NO_MOBILE", message: "No mobile registered for this member" } }, { status: 400 });
  return NextResponse.json(sent);
}
