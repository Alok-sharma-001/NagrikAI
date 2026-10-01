import { evaluateScheme } from "./eligibility";
import { getDocument, SCHEMES } from "./kb";
import { buildReminders } from "./match";
import type { DocumentInfo, LeafResult, Profile, ProfileField, Reminder, Scheme, Text, Verdict } from "./types";

/**
 * Family model. Facts about the home are entered ONCE for the whole family;
 * each member only answers questions about themselves. Facts about children
 * (school-going child, daughter under 10…) are derived from the member list,
 * so nobody is asked them.
 */

export const HOUSEHOLD_FIELDS = [
  "state",
  "district",
  "area",
  "annualIncome",
  "category",
  "isMinority",
  "isPVTG",
  "isBPL",
  "ownsPuccaHouse",
  "hasLpgConnection",
  "hasToilet",
  "landHectares",
  "breadwinnerDiedRecently",
] as const satisfies readonly ProfileField[];
export type HouseholdField = (typeof HOUSEHOLD_FIELDS)[number];
export type Household = Pick<Profile, HouseholdField>;

export const RELATIONS = ["self", "spouse", "son", "daughter", "father", "mother", "brother", "sister", "grandchild", "other"] as const;
export type Relation = (typeof RELATIONS)[number];

export type MemberProfile = Omit<Profile, HouseholdField | "hasChildUnder6" | "hasSchoolChildren" | "hasGirlChildUnder10">;

export type Member = {
  id: string;
  name: string;
  relation: Relation;
  isHead: boolean;
  status: "active" | "pending";
  hasLogin: boolean;
  profile: MemberProfile;
};

export type Family = { id: string; code: string; /** MP Samagra family ID, when the family was linked through the registry. */ samagraId?: string; household: Household; members: Member[] };

/** Everything the engine needs to know about one member, including family-derived facts. */
export function memberProfile(family: Family, member: Member): Profile {
  const p: Profile = { ...family.household, ...member.profile, name: member.name };
  const others = family.members.filter((m) => m.id !== member.id && m.status === "active");
  const isAdult = (member.profile.age ?? 0) >= 18;
  // A breadwinner's recent death only matters if someone in the family is widowed.
  const anyWidowed = family.members.some((m) => m.status === "active" && m.profile.maritalStatus === "widowed");
  if (p.breadwinnerDiedRecently === undefined && !anyWidowed) p.breadwinnerDiedRecently = false;
  const ages = others.map((m) => ({ age: m.profile.age, gender: m.profile.gender }));
  if (isAdult) {
    // We know the whole family, so these become definite yes/no instead of questions.
    p.hasChildUnder6 = ages.some((a) => a.age !== undefined && a.age < 6);
    p.hasSchoolChildren = ages.some((a) => a.age !== undefined && a.age >= 6 && a.age <= 14);
    p.hasGirlChildUnder10 = ages.some((a) => a.gender === "female" && a.age !== undefined && a.age < 10);
  } else {
    p.hasChildUnder6 = false;
    p.hasSchoolChildren = false;
    p.hasGirlChildUnder10 = false;
    p.isPregnantOrLactating = false;
    p.wantsToStartBusiness ??= false;
    // Children aren't asked about work.
    if ((member.profile.age ?? 99) < 15) p.occupation ??= member.profile.isStudent ? "student" : "other";
  }
  return p;
}

export type MemberVerdict = {
  memberId: string;
  name: string;
  verdict: Verdict;
  matched: LeafResult[];
  failed: LeafResult[];
  unknown: LeafResult[];
};

export type FamilySchemeResult = {
  scheme: Scheme;
  level: "household" | "individual";
  /** Best verdict across members: eligible > possible > ineligible. */
  verdict: Verdict;
  members: MemberVerdict[];
};

export type FamilyMatch = {
  schemes: FamilySchemeResult[];
  totals: { eligible: number; possible: number; cashPerYear: number; oneTime: number; cover: number };
  perMember: { memberId: string; name: string; eligible: number; possible: number }[];
  checklist: { doc: DocumentInfo; neededFor: string[]; members: string[] }[];
  reminders: Reminder[];
};

const RANK: Record<Verdict, number> = { eligible: 2, possible: 1, ineligible: 0 };
const value = (s: Scheme) => (s.benefit.cashPerYear ?? 0) + (s.benefit.oneTime ?? 0);

export function evaluateFamily(family: Family): FamilyMatch {
  const active = family.members.filter((m) => m.status === "active");
  const profiles = new Map(active.map((m) => [m.id, memberProfile(family, m)]));

  const schemes: FamilySchemeResult[] = SCHEMES.map((scheme) => {
    const members = active.map((m): MemberVerdict => {
      const r = evaluateScheme(scheme, profiles.get(m.id)!);
      return { memberId: m.id, name: m.name, verdict: r.verdict, matched: r.matched, failed: r.failed, unknown: r.unknown };
    });
    const verdict = members.reduce<Verdict>((best, m) => (RANK[m.verdict] > RANK[best] ? m.verdict : best), "ineligible");
    return { scheme, level: scheme.level ?? "individual", verdict, members };
  }).sort(
    (a, b) =>
      RANK[b.verdict] - RANK[a.verdict] ||
      value(b.scheme) - value(a.scheme) ||
      (b.scheme.benefit.cover ?? 0) - (a.scheme.benefit.cover ?? 0),
  );

  // Household schemes count once; individual schemes count for every eligible member.
  // Alternatives (same altGroup) count once per member — the most valuable one.
  const totals = { eligible: 0, possible: 0, cashPerYear: 0, oneTime: 0, cover: 0 };
  const altBest = new Map<string, Scheme>(); // `${group}|${memberId}` → best scheme
  for (const r of schemes) {
    if (r.verdict !== "eligible" || !r.scheme.altGroup) continue;
    for (const m of r.members.filter((x) => x.verdict === "eligible")) {
      const k = `${r.scheme.altGroup}|${m.memberId}`;
      const cur = altBest.get(k);
      if (!cur || value(r.scheme) > value(cur)) altBest.set(k, r.scheme);
    }
  }
  for (const r of schemes) {
    if (r.verdict === "possible") totals.possible++;
    if (r.verdict !== "eligible") continue;
    totals.eligible++;
    if (r.scheme.intakeClosed || r.scheme.eventBased) continue; // shown, but not counted as money the family "can get" today
    const counted = r.members.filter((m) => m.verdict === "eligible" && (!r.scheme.altGroup || altBest.get(`${r.scheme.altGroup}|${m.memberId}`)?.id === r.scheme.id));
    const times = r.level === "household" ? 1 : counted.length;
    totals.cashPerYear += (r.scheme.benefit.cashPerYear ?? 0) * times;
    totals.oneTime += (r.scheme.benefit.oneTime ?? 0) * times;
    totals.cover += (r.scheme.benefit.cover ?? 0) * times;
  }

  const perMember = active.map((m) => ({
    memberId: m.id,
    name: m.name,
    eligible: schemes.filter((r) => r.members.find((x) => x.memberId === m.id)?.verdict === "eligible").length,
    possible: schemes.filter((r) => r.members.find((x) => x.memberId === m.id)?.verdict === "possible").length,
  }));

  const docs = new Map<string, { neededFor: Set<string>; members: Set<string> }>();
  for (const r of schemes.filter((x) => x.verdict === "eligible")) {
    const who = r.members.filter((m) => m.verdict === "eligible").map((m) => m.name);
    for (const d of r.scheme.documents) {
      const e = docs.get(d) ?? { neededFor: new Set(), members: new Set() };
      e.neededFor.add(r.scheme.id);
      who.forEach((w) => e.members.add(w));
      docs.set(d, e);
    }
  }
  const checklist = [...docs.entries()]
    .map(([id, e]) => ({ doc: getDocument(id)!, neededFor: [...e.neededFor], members: [...e.members] }))
    .filter((c) => c.doc)
    .sort((a, b) => b.neededFor.length - a.neededFor.length);

  const reminderSchemes = schemes.filter((r) => r.verdict !== "ineligible");
  const reminders = buildReminders(reminderSchemes.map((r) => ({ scheme: r.scheme, verdict: r.verdict, matched: [], failed: [], unknown: [] })));

  return { schemes, totals, perMember, checklist, reminders };
}

/** Split a flat profile (e.g. from a registration wizard) into household and member parts. */
export function splitProfile(p: Profile): { household: Household; member: MemberProfile } {
  const household: Record<string, unknown> = {};
  const member: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || k === "name" || k === "hasChildUnder6" || k === "hasSchoolChildren" || k === "hasGirlChildUnder10") continue;
    ((HOUSEHOLD_FIELDS as readonly string[]).includes(k) ? household : member)[k] = v;
  }
  return { household: household as Household, member: member as MemberProfile };
}

export const RELATION_NAMES: Record<Relation, Text & { icon: string }> = {
  self: { en: "Self", hi: "स्वयं", icon: "🙋" },
  spouse: { en: "Husband / Wife", hi: "पति / पत्नी", icon: "💑" },
  son: { en: "Son", hi: "बेटा", icon: "👦" },
  daughter: { en: "Daughter", hi: "बेटी", icon: "👧" },
  father: { en: "Father", hi: "पिता", icon: "👴" },
  mother: { en: "Mother", hi: "माता", icon: "👵" },
  brother: { en: "Brother", hi: "भाई", icon: "🧑" },
  sister: { en: "Sister", hi: "बहन", icon: "👩" },
  grandchild: { en: "Grandchild", hi: "पोता / पोती", icon: "🧒" },
  other: { en: "Other", hi: "अन्य", icon: "👤" },
};

/** One claimable benefit: a family-level scheme once, or an individual scheme for one member. */
export type BenefitUnit = { scheme: Scheme; memberId: string; memberName?: string };

/** Every benefit the family is eligible for, as separate claimable units (memberId "" = whole family). */
export function eligibleUnits(match: FamilyMatch): BenefitUnit[] {
  return match.schemes
    .filter((r) => r.verdict === "eligible")
    .flatMap((r): BenefitUnit[] =>
      r.level === "household"
        ? [{ scheme: r.scheme, memberId: "" }]
        : r.members.filter((m) => m.verdict === "eligible").map((m) => ({ scheme: r.scheme, memberId: m.memberId, memberName: m.name })),
    );
}
