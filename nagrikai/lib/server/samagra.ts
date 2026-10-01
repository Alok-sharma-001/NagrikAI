import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import registry from "@/data/demo/samagra.json";
import type { Household, MemberProfile, Relation } from "@/lib/family";
import { bumpOtpTries, deleteOtpTicket, getOtpTicket, hashPin, markOtpVerified, saveOtpTicket, verifyPin } from "./db";

/**
 * Samagra adapter. Samagra is Madhya Pradesh's family registry: an 8-digit
 * family ID and a 9-digit member ID, Aadhaar e-KYC'd, holding each member's
 * name, date of birth, gender, relation, category and BPL status.
 *
 * Real access needs an agreement with the MP government, so this file reads
 * FICTIONAL demo families from data/demo/samagra.json. Everything else in the
 * app only calls the functions below — swapping in the real API changes this
 * file alone. OTPs are "sent" by returning them to the screen in demo mode.
 */

type RegistryMember = {
  memberId: string;
  name: string;
  gender: "male" | "female" | "transgender";
  dob: string;
  relation: Relation;
  maritalStatus?: "single" | "married" | "widowed" | "divorced";
  isDisabled?: boolean;
  disabilityPercent?: number;
  mobile: string | null;
};
type RegistryFamily = {
  familyId: string;
  district: string;
  area: "rural" | "urban";
  category: "general" | "obc" | "sc" | "st" | "ews";
  isMinority: boolean;
  isPVTG?: boolean;
  isBPL: boolean;
  members: RegistryMember[];
};

const FAMILIES = (registry as { families: RegistryFamily[] }).families;

export const isDemoRegistry = true;

function ageFrom(dob: string, now = new Date()): number {
  const d = new Date(dob);
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

/** "सुनीता बाई" → "सु•••• बा••" so a family ID alone doesn't reveal full names. */
function maskName(name: string): string {
  return name
    .split(" ")
    .map((w) => {
      const chars = [...w];
      const keep = chars.length <= 2 ? 1 : 2;
      return chars.slice(0, keep).join("") + "•".repeat(Math.max(2, chars.length - keep));
    })
    .join(" ");
}
const maskMobile = (m: string) => "XXXXXX" + m.slice(-4);

export function lookupFamily(familyId: string) {
  const f = FAMILIES.find((x) => x.familyId === familyId);
  if (!f) return null;
  return {
    familyId: f.familyId,
    district: f.district,
    members: f.members.map((m) => ({
      memberId: m.memberId,
      maskedName: maskName(m.name),
      age: ageFrom(m.dob),
      gender: m.gender,
      relation: m.relation,
      canVerify: m.mobile !== null, // OTP goes to the mobile registered in Samagra
    })),
  };
}

/* ---------- OTP verification (10-minute tickets, stored hashed in the database) ---------- */

export function sendOtp(familyId: string, memberId: string) {
  const m = FAMILIES.find((f) => f.familyId === familyId)?.members.find((x) => x.memberId === memberId);
  if (!m || !m.mobile) return null;
  const ticketId = randomBytes(18).toString("base64url");
  const otp = String(randomInt(100000, 1000000));
  saveOtpTicket({ id: ticketId, familyId, memberId, otpHash: hashPin(otp), tries: 0, verified: false, expiresAt: Date.now() + 10 * 60_000 });
  // Real system: SMS to m.mobile via the state's gateway. Demo: hand it back to show on screen.
  return { ticketId, mobileMasked: maskMobile(m.mobile), demoOtp: isDemoRegistry ? otp : undefined };
}

export function verifyOtp(ticketId: string, otp: string): "ok" | "wrong" | "expired" | "locked" {
  const t = getOtpTicket(ticketId);
  if (!t || t.expiresAt < Date.now()) return "expired";
  if (t.tries >= 5) return "locked";
  if (!verifyPin(otp, t.otpHash)) {
    bumpOtpTries(ticketId);
    return "wrong";
  }
  markOtpVerified(ticketId);
  return "ok";
}

/** Full registry data, released only for a verified ticket. */
export function verifiedFamily(ticketId: string) {
  const t = getOtpTicket(ticketId);
  if (!t || !t.verified || t.expiresAt < Date.now()) return null;
  const f = FAMILIES.find((x) => x.familyId === t.familyId)!;
  const household: Household = {
    state: "Madhya Pradesh",
    district: f.district,
    area: f.area,
    category: f.category,
    isMinority: f.isMinority,
    isBPL: f.isBPL,
    ...(f.isPVTG !== undefined ? { isPVTG: f.isPVTG } : {}),
  };
  const members = f.members.map((m) => {
    const profile: MemberProfile = { age: ageFrom(m.dob), gender: m.gender };
    if (m.maritalStatus) profile.maritalStatus = m.maritalStatus;
    if (m.isDisabled !== undefined) profile.isDisabled = m.isDisabled;
    if (m.disabilityPercent !== undefined) profile.disabilityPercent = m.disabilityPercent;
    return { samagraMemberId: m.memberId, name: m.name, relation: m.relation, profile };
  });
  return { familyId: f.familyId, selfMemberId: t.memberId, household, members };
}

export function consumeTicket(ticketId: string) {
  deleteOtpTicket(ticketId);
}
