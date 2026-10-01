import { describe, expect, it } from "vitest";
import { generateDemoFamilies } from "@/lib/demo";
import { evaluateFamily, type Family } from "@/lib/family";
import { rowsToCsv, summarize, type FamilyRecord } from "@/lib/officer";

const demo = generateDemoFamilies(80, 7);
const records: FamilyRecord[] = demo.map((d, i) => {
  const members = d.members.map((m, k) => ({ id: `f${i}m${k}`, name: m.name, relation: m.relation, isHead: k === 0, status: "active" as const, hasLogin: false, profile: m.profile }));
  const family: Family = { id: `f${i}`, code: `C${i}`, household: d.household, members };
  const statuses = Object.fromEntries(d.statuses.map((s) => [`${s.schemeId}|${s.memberIndex === null ? "" : members[s.memberIndex].id}`, s.status]));
  return { family, statuses, demo: true };
});

describe("officer saturation summary", () => {
  const { summary, rows } = summarize(records);
  it("is deterministic and adds up", () => {
    expect(generateDemoFamilies(80, 7)).toEqual(demo);
    expect(summary.totals.families).toBe(80);
    expect(summary.totals.eligible).toBe(summary.totals.receiving + summary.totals.gap);
    expect(summary.schemes.reduce((t, s) => t + s.gap, 0)).toBe(summary.totals.gap);
    expect(summary.byDistrict.reduce((t, d) => t + d.families, 0)).toBe(80);
  });
  it("filters by district", () => {
    const one = summarize(records, "Dindori").summary;
    expect(one.totals.families).toBe(10);
    expect(one.byDistrict.map((d) => d.district)).toEqual(["Dindori"]);
  });
  it("export has one row per gap and no names", () => {
    expect(rows.length).toBe(summary.totals.gap);
    const csv = rowsToCsv(rows);
    for (const d of demo) for (const m of d.members) expect(csv).not.toContain(m.name);
  });
});

describe("alternative schemes are not double-counted", () => {
  it("Seekho-Kamao and PM Internship: only the larger one counts", () => {
    const family: Family = {
      id: "a", code: "a", household: { state: "Madhya Pradesh", area: "urban", annualIncome: 120000, category: "general", isBPL: false },
      members: [{ id: "m", name: "अनिल", relation: "self", isHead: true, status: "active", hasLogin: false, profile: { age: 22, gender: "male", maritalStatus: "single", occupation: "unemployed", hasBankAccount: false, isDisabled: false } }],
    };
    const fm = evaluateFamily(family);
    const got = (id: string) => fm.schemes.find((s) => s.scheme.id === id)!.verdict;
    expect(got("mp-seekho-kamao")).toBe("eligible");
    expect(got("pm-internship")).toBe("eligible");
    expect(fm.totals.cashPerYear).toBeLessThan(96000 + 60000);
    expect(fm.totals.cashPerYear).toBeGreaterThanOrEqual(96000);
  });
});
