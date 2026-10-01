import type { Occupation, Profile } from "./types";

/** Occupations that are unorganised-sector by nature; members are very rarely in EPFO/ESIC. */
const INFORMAL: Occupation[] = [
  "farmer",
  "agri_labourer",
  "construction_worker",
  "domestic_worker",
  "street_vendor",
  "artisan",
  "fisherman",
  "homemaker",
  "unemployed",
];

/**
 * Fill in fields that follow logically from others, so the user isn't asked
 * questions whose answers are already implied. Explicit answers always win.
 */
export function normalizeProfile(p: Profile): Profile {
  const out: Profile = { ...p };
  const setIfUnset = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    if (out[k] === undefined) out[k] = v;
  };

  if (out.occupation) {
    setIfUnset("isGovtEmployee", out.occupation === "govt_employee");
    setIfUnset("isStudent", out.occupation === "student");
    if (INFORMAL.includes(out.occupation)) setIfUnset("isEpfoMember", false);
    if (out.occupation !== "farmer") setIfUnset("landHectares", 0);
  }
  // No income tax is payable at these income levels under either regime.
  if (out.annualIncome !== undefined && out.annualIncome <= 700000) setIfUnset("isIncomeTaxPayer", false);
  if (out.isDisabled === false) setIfUnset("disabilityPercent", 0);
  // Baiga / Bharia / Saharia are Scheduled Tribes — nobody else needs to be asked.
  if (out.category && out.category !== "st") setIfUnset("isPVTG", false);
  if (out.gender && out.gender !== "female") setIfUnset("isPregnantOrLactating", false);
  if (out.maritalStatus && out.maritalStatus !== "widowed") setIfUnset("breadwinnerDiedRecently", false);
  return out;
}

/** Merge newly learned fields into an existing profile (new values override). */
export function mergeProfile(base: Profile, patch: Partial<Profile>): Profile {
  const out: Profile = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
