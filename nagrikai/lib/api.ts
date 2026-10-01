import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { OCCUPATIONS, STUDY_LEVELS } from "./types";

/** Validates incoming profiles; unknown keys are dropped, bad values rejected. */
export const ProfileSchema = z
  .object({
    name: z.string().max(80),
    age: z.number().int().min(0).max(120),
    gender: z.enum(["male", "female", "transgender"]),
    state: z.string().max(60),
    district: z.string().max(60),
    area: z.enum(["rural", "urban"]),
    annualIncome: z.number().min(0),
    category: z.enum(["general", "obc", "sc", "st", "ews"]),
    isMinority: z.boolean(),
    isPVTG: z.boolean(),
    maritalStatus: z.enum(["single", "married", "widowed", "divorced"]),
    occupation: z.enum(OCCUPATIONS),
    isBPL: z.boolean(),
    isDisabled: z.boolean(),
    disabilityPercent: z.number().min(0).max(100),
    landHectares: z.number().min(0),
    ownsPuccaHouse: z.boolean(),
    hasLpgConnection: z.boolean(),
    hasToilet: z.boolean(),
    hasBankAccount: z.boolean(),
    isIncomeTaxPayer: z.boolean(),
    isGovtEmployee: z.boolean(),
    isEpfoMember: z.boolean(),
    isPregnantOrLactating: z.boolean(),
    hasChildUnder6: z.boolean(),
    hasSchoolChildren: z.boolean(),
    hasGirlChildUnder10: z.boolean(),
    isStudent: z.boolean(),
    studyLevel: z.enum(STUDY_LEVELS),
    wantsToStartBusiness: z.boolean(),
    breadwinnerDiedRecently: z.boolean(),
  })
  .partial();

export const LangSchema = z.enum(["en", "hi"]).default("hi");

export function badRequest(message: string) {
  return NextResponse.json({ error: { code: "BAD_REQUEST", message } }, { status: 400 });
}

import { HOUSEHOLD_FIELDS, RELATIONS } from "./family";

const householdMask = Object.fromEntries(HOUSEHOLD_FIELDS.map((f) => [f, true])) as { [K in (typeof HOUSEHOLD_FIELDS)[number]]: true };
export const HouseholdSchema = ProfileSchema.pick(householdMask);
export const MemberProfileSchema = ProfileSchema.omit({
  ...householdMask,
  name: true,
  hasChildUnder6: true,
  hasSchoolChildren: true,
  hasGirlChildUnder10: true,
});
export const MobileSchema = z.string().regex(/^[6-9]\d{9}$/, "10-digit Indian mobile number");
export const PinSchema = z.string().regex(/^\d{4}$/, "4-digit PIN");
export const NameSchema = z.string().trim().min(1).max(60);
export const RelationSchema = z.enum(RELATIONS);

/** Validate field by field, keeping the good ones (one bad value must not wipe the rest). */
export function cleanProfile(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    const r = ProfileSchema.safeParse({ [k]: v });
    if (r.success && k in r.data) out[k] = (r.data as Record<string, unknown>)[k];
  }
  return out;
}
