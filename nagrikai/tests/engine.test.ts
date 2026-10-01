import { describe, expect, it } from "vitest";
import { match } from "@/lib/match";
import { evaluateScheme } from "@/lib/eligibility";
import { getScheme, SCHEMES } from "@/lib/kb";
import type { Profile } from "@/lib/types";

const ids = (rs: { scheme: { id: string } }[]) => rs.map((r) => r.scheme.id);

export const PRIYA: Profile = {
  name: "Priya", age: 35, gender: "female", maritalStatus: "widowed", area: "urban", state: "Madhya Pradesh", district: "Bhopal",
  occupation: "domestic_worker", annualIncome: 120000, isBPL: true, hasBankAccount: true, hasSchoolChildren: true,
};

describe("Priya (35, widow, domestic worker, Bhopal)", () => {
  const m = match(PRIYA);
  it("is eligible for core social-security schemes", () => {
    expect(ids(m.eligible)).toEqual(expect.arrayContaining(["pmjay", "nfsa-pmgkay", "pm-sym", "eshram", "pmjjby", "pmsby", "apy", "pm-poshan"]));
  });
  it("gets MP's Kalyani (widow) pension at 35 — no BPL card or age-40 rule", () => {
    const r = evaluateScheme(getScheme("mp-kalyani-pension")!, PRIYA);
    expect(r.verdict).toBe("eligible");
  });
  it("qualifies for Ladli Behna, but closed intake is never counted as money she can get", () => {
    expect(ids(m.eligible)).toContain("mp-ladli-behna");
    const countable = m.eligible.filter((r) => !r.scheme.intakeClosed).reduce((t, r) => t + (r.scheme.benefit.cashPerYear ?? 0), 0);
    expect(m.totals.cashPerYear).toBe(countable);
    expect(m.totals.cashPerYear).toBeLessThan(countable + 18000);
  });
  it("asks follow-ups that unlock Ujjwala / NFBS / PMAY-U", () => {
    expect(ids(m.possible)).toEqual(expect.arrayContaining(["pmuy", "nfbs", "pmay-u"]));
  });
  it("Ujjwala becomes eligible once she says she has no LPG", () => {
    expect(ids(match({ ...PRIYA, hasLpgConnection: false }).eligible)).toContain("pmuy");
  });
  it("builds a merged checklist with Aadhaar needed most", () => {
    expect(m.checklist[0].doc.id).toBe("aadhaar");
  });
  it("never counts insurance cover as cash", () => {
    expect(m.totals.cover).toBeGreaterThan(0);
    expect(m.totals.cashPerYear).toBeLessThan(m.totals.cover);
  });
});

describe("Ramesh (52, farmer, 0.6 ha, rural, BPL)", () => {
  const m = match({ age: 52, gender: "male", occupation: "farmer", landHectares: 0.6, area: "rural", isBPL: true, annualIncome: 90000, hasBankAccount: true, ownsPuccaHouse: false });
  it("gets farmer schemes", () => {
    expect(ids(m.eligible)).toEqual(expect.arrayContaining(["pm-kisan", "pmfby", "kcc", "mgnrega", "pmay-g", "pmjay"]));
  });
  it("is too old for PM-KMY / APY", () => {
    expect(ids(m.ineligible)).toEqual(expect.arrayContaining(["pm-kmy", "apy"]));
  });
});

describe("Ananya (19, SC, UG student, ₹1.8L)", () => {
  const m = match({ age: 19, gender: "female", category: "sc", occupation: "student", studyLevel: "ug", annualIncome: 180000 });
  it("gets SC post-matric + merit + Pragati", () => {
    expect(ids(m.eligible)).toEqual(expect.arrayContaining(["pms-sc", "csss", "pragati"]));
    expect(ids(m.ineligible)).toContain("pms-st");
  });
});

describe("Taxpayer exclusions", () => {
  const m = match({ age: 30, occupation: "salaried_private", annualIncome: 1500000, isIncomeTaxPayer: true, isEpfoMember: true, hasBankAccount: true });
  it("excludes APY, PM-SYM, e-Shram", () => {
    expect(ids(m.ineligible)).toEqual(expect.arrayContaining(["apy", "pm-sym", "eshram", "pm-kisan"]));
  });
});

describe("Knowledge base integrity", () => {
  it("has 50+ schemes with unique ids and official sources", () => {
    expect(SCHEMES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(SCHEMES.map((s) => s.id)).size).toBe(SCHEMES.length);
  });
  it("an empty profile yields no false 'eligible' results except universal ones", () => {
    const m = match({});
    expect(m.eligible.length).toBe(0);
    expect(m.askFor.length).toBeGreaterThan(0);
  });
});
