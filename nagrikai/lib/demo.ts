import { eligibleUnits, evaluateFamily, type Family, type Household, type MemberProfile, type Relation } from "./family";
import type { Occupation } from "./types";

/**
 * Synthetic families for demonstrating the officer dashboard. Entirely fictional:
 * generated from a fixed seed so the numbers are the same in every demo.
 */

type DemoMember = { name: string; relation: Relation; profile: MemberProfile };
export type DemoFamily = {
  household: Household;
  members: DemoMember[];
  statuses: { schemeId: string; memberIndex: number | null; status: "receiving" | "applied" | "rejected" }[];
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// district, share rural, tribal-heavy, how well benefits already reach people (1 = state average)
const DISTRICTS: [string, number, boolean, number][] = [
  ["Bhopal", 0.2, false, 1.15], ["Indore", 0.2, false, 1.2], ["Gwalior", 0.3, false, 1.0], ["Sehore", 0.8, false, 0.95],
  ["Sagar", 0.7, false, 0.85], ["Rewa", 0.75, false, 0.8], ["Jhabua", 0.9, true, 0.65], ["Dindori", 0.92, true, 0.6],
];
const M = ["रमेश", "सुरेश", "मोहन", "राजू", "दिनेश", "अनिल", "विजय", "संतोष", "कमलेश", "मनोज", "राकेश", "भूरा", "कालू", "प्रकाश", "गोविंद"];
const F = ["सुनीता", "गीता", "रेखा", "सीमा", "कमला", "शांति", "पूजा", "लक्ष्मी", "राधा", "सावित्री", "ममता", "फूलवती", "रामकली", "आशा", "कविता"];

// How often an eligible person is already receiving each scheme (state-average guess for the demo).
const UPTAKE: Record<string, number> = {
  "nfsa-pmgkay": 0.88, "pm-kisan": 0.8, "mp-kisan-kalyan": 0.72, "mp-ladli-behna": 0.62, pmjay: 0.55, pmuy: 0.6, mgnrega: 0.45,
  "mp-kalyani-pension": 0.5, "mp-vriddha-pension": 0.55, "mp-divyang-pension": 0.4, "pm-poshan": 0.85, "icds-anganwadi": 0.6,
  "mp-ladli-laxmi": 0.45, "mp-sambal": 0.35, eshram: 0.4, pmjjby: 0.2, pmsby: 0.25, apy: 0.08, "pm-sym": 0.06, "mp-aahar-anudan": 0.5,
};

export function generateDemoFamilies(count = 240, seed = 2026): DemoFamily[] {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const chance = (p: number) => r() < p;
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const out: DemoFamily[] = [];

  for (let i = 0; i < count; i++) {
    const [district, ruralShare, tribal, reach] = DISTRICTS[i % DISTRICTS.length];
    const area = chance(ruralShare) ? "rural" : "urban";
    const c = r();
    const category = tribal ? (c < 0.72 ? "st" : c < 0.85 ? "obc" : c < 0.93 ? "sc" : "general") : c < 0.42 ? "obc" : c < 0.6 ? "sc" : c < 0.72 ? "st" : "general";
    const isBPL = chance((area === "rural" ? 0.55 : 0.35) + (category === "st" ? 0.2 : 0));
    const household: Household = {
      state: "Madhya Pradesh", district, area, category,
      isMinority: chance(0.07),
      isBPL,
      annualIncome: 12 * (isBPL ? pick([5000, 10000, 10000]) : pick([10000, 15000, 25000, 25000, 50000])),
      ownsPuccaHouse: chance(isBPL ? 0.35 : 0.7),
      hasLpgConnection: chance(isBPL ? 0.6 : 0.9),
      ...(area === "rural" ? { hasToilet: chance(0.75) } : {}),
      ...(category === "st" ? { isPVTG: district === "Dindori" && chance(0.6) } : {}),
    };

    const members: DemoMember[] = [];
    const headMale = chance(0.8);
    const headAge = int(28, 62);
    const widowed = !headMale && chance(0.55);
    const married = !widowed && chance(0.9);
    const work = (male: boolean): Occupation =>
      area === "rural"
        ? pick<Occupation>(["farmer", "farmer", "agri_labourer", "agri_labourer", "construction_worker", "self_employed", "artisan"])
        : male
          ? pick<Occupation>(["construction_worker", "street_vendor", "self_employed", "salaried_private", "artisan", "unemployed"])
          : pick<Occupation>(["domestic_worker", "domestic_worker", "street_vendor", "self_employed", "homemaker"]);
    const adult = (male: boolean, age: number, marital: MemberProfile["maritalStatus"], occ: Occupation): MemberProfile => ({
      age, gender: male ? "male" : "female", maritalStatus: marital, occupation: occ,
      hasBankAccount: chance(0.85), isDisabled: chance(0.04),
      ...(occ === "salaried_private" ? { isEpfoMember: chance(0.6) } : {}),
    });

    const headOcc = work(headMale);
    members.push({ name: pick(headMale ? M : F), relation: "self", profile: adult(headMale, headAge, widowed ? "widowed" : married ? "married" : "single", headOcc) });
    if (headOcc === "farmer") household.landHectares = pick([0.4, 0.8, 0.8, 1.5, 2, 4]);
    if (married) {
      const sAge = Math.max(20, headAge + int(-6, 4));
      members.push({ name: pick(headMale ? F : M), relation: "spouse", profile: adult(!headMale, sAge, "married", headMale ? (chance(0.7) ? "homemaker" : work(false)) : work(true)) });
    }
    const kids = headAge < 55 ? int(0, 3) : int(0, 1);
    for (let k = 0; k < kids; k++) {
      const age = int(0, Math.min(22, headAge - 19));
      const male = chance(0.5);
      const p: MemberProfile = { age, gender: male ? "male" : "female", isDisabled: false };
      if (age >= 6 && age <= 17) { p.isStudent = chance(0.92); if (p.isStudent) p.studyLevel = age <= 13 ? "class_1_8" : age <= 15 ? "class_9_10" : "class_11_12"; }
      if (age >= 18) {
        p.maritalStatus = "single";
        const studying = chance(0.4);
        p.occupation = studying ? "student" : pick<Occupation>(["unemployed", "unemployed", "agri_labourer", "construction_worker"]);
        if (studying) { p.isStudent = true; p.studyLevel = "ug"; }
        p.hasBankAccount = chance(0.8);
      } else if (age >= 10) p.hasBankAccount = chance(0.4);
      members.push({ name: pick(male ? M : F), relation: male ? "son" : "daughter", profile: p });
    }
    if (chance(0.25)) {
      const male = chance(0.4);
      members.push({ name: pick(male ? M : F), relation: male ? "father" : "mother", profile: { ...adult(male, int(62, 80), chance(0.6) ? "widowed" : "married", "other"), isDisabled: chance(0.12), disabilityPercent: 50 } });
    }
    for (const m of members) if (m.profile.isDisabled) m.profile.disabilityPercent ??= pick([50, 50, 80]);

    // Decide what they already receive, from what they are actually eligible for.
    const family: Family = { id: "x", code: "x", household, members: members.map((m, idx) => ({ id: String(idx), name: m.name, relation: m.relation, isHead: idx === 0, status: "active", hasLogin: false, profile: m.profile })) };
    const statuses: DemoFamily["statuses"] = [];
    for (const u of eligibleUnits(evaluateFamily(family))) {
      if (u.scheme.eventBased) continue;
      const p = Math.min(0.95, (UPTAKE[u.scheme.id] ?? 0.22) * reach);
      const x = r();
      const status = x < p ? "receiving" : x < p + 0.08 ? "applied" : x < p + 0.11 ? "rejected" : null;
      if (status) statuses.push({ schemeId: u.scheme.id, memberIndex: u.memberId === "" ? null : Number(u.memberId), status });
    }
    out.push({ household, members, statuses });
  }
  return out;
}
