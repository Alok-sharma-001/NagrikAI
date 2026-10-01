import { describe, expect, it } from "vitest";
import { evaluateFamily, memberProfile, splitProfile, type Family } from "@/lib/family";

const family: Family = {
  id: "f1",
  code: "ABC123",
  household: { state: "Madhya Pradesh", district: "Bhopal", area: "urban", annualIncome: 120000, category: "sc", isBPL: true, ownsPuccaHouse: false, hasLpgConnection: false },
  members: [
    { id: "m1", name: "Priya", relation: "self", isHead: true, status: "active", hasLogin: true,
      profile: { age: 35, gender: "female", maritalStatus: "widowed", occupation: "domestic_worker", hasBankAccount: true } },
    { id: "m2", name: "Pooja", relation: "daughter", isHead: false, status: "active", hasLogin: false,
      profile: { age: 15, gender: "female", isStudent: true, studyLevel: "class_9_10" } },
    { id: "m3", name: "Rahul", relation: "son", isHead: false, status: "active", hasLogin: false,
      profile: { age: 9, gender: "male", isStudent: true, studyLevel: "class_1_8" } },
  ],
};

describe("family evaluation", () => {
  const fm = evaluateFamily(family);
  const get = (id: string) => fm.schemes.find((s) => s.scheme.id === id)!;

  it("derives child facts for the parent — no need to ask", () => {
    const p = memberProfile(family, family.members[0]);
    expect(p).toMatchObject({ hasSchoolChildren: true, hasChildUnder6: false, hasGirlChildUnder10: false, category: "sc" });
  });
  it("finds the daughter's own scholarship", () => {
    const r = get("prems-sc");
    expect(r.verdict).toBe("eligible");
    expect(r.members.find((m) => m.memberId === "m2")!.verdict).toBe("eligible");
  });
  it("household schemes count once, individual schemes per member", () => {
    expect(get("pmjay").level).toBe("household");
    const cashOnlyHousehold = fm.schemes
      .filter((s) => s.verdict === "eligible" && !s.scheme.intakeClosed && !s.scheme.eventBased)
      .reduce((t, s) => t + (s.scheme.benefit.cashPerYear ?? 0) * (s.level === "household" ? 1 : s.members.filter((m) => m.verdict === "eligible").length), 0);
    expect(fm.totals.cashPerYear).toBe(cashOnlyHousehold);
    expect(get("pmuy").verdict).toBe("eligible"); // Priya is the adult woman, no LPG
  });
  it("pending members are not evaluated", () => {
    const f2 = { ...family, members: [...family.members, { ...family.members[1], id: "m4", name: "X", status: "pending" as const }] };
    expect(evaluateFamily(f2).perMember.map((m) => m.memberId)).not.toContain("m4");
  });
  it("splits a flat profile into household and member parts", () => {
    const { household, member } = splitProfile({ age: 30, isBPL: true, area: "rural", occupation: "farmer", landHectares: 1 });
    expect(household).toEqual({ isBPL: true, area: "rural", landHectares: 1 });
    expect(member).toEqual({ age: 30, occupation: "farmer" });
  });
});

import { answersToProfile, profileToAnswers, visibleSteps } from "@/lib/wizard";

describe("registration wizard", () => {
  it("asks a young child only a handful of questions", () => {
    const ids = visibleSteps({ age: 8 }, "member").map((s) => s.id);
    expect(ids).toEqual(["name", "relation", "gender", "age", "study", "isDisabled"]);
  });
  it("a joining member never re-enters household facts", () => {
    const ids = visibleSteps({ age: 30, gender: "male" }, "join").map((s) => s.id);
    expect(ids).not.toContain("ration");
    expect(ids).toContain("code");
  });
  it("converts picture answers into profile fields and back", () => {
    const p = answersToProfile({ income: 10000, ration: "priority", house: "kutcha", study: "none", age: 30 });
    expect(p).toMatchObject({ annualIncome: 120000, isBPL: true, ownsPuccaHouse: false, isStudent: false });
    expect(profileToAnswers(p)).toMatchObject({ income: 10000, ration: "priority", house: "kutcha", study: "none" });
  });
  it("skips the breadwinner question when nobody is widowed", () => {
    const fm = evaluateFamily({ ...family, members: family.members.map((m) => ({ ...m, profile: { ...m.profile, maritalStatus: m.isHead ? ("married" as const) : undefined } })) });
    expect(fm.schemes.find((s) => s.scheme.id === "nfbs")!.verdict).toBe("ineligible");
  });
});

describe("Madhya Pradesh schemes for a family", () => {
  const fm = evaluateFamily(family);
  const get = (id: string) => fm.schemes.find((s) => s.scheme.id === id)!;
  it("daughter gets Ladli Laxmi; mother gets Kalyani pension and Sambal", () => {
    expect(get("mp-ladli-laxmi").members.find((m) => m.memberId === "m2")!.verdict).toBe("eligible");
    expect(get("mp-kalyani-pension").members.find((m) => m.memberId === "m1")!.verdict).toBe("eligible");
    expect(get("mp-sambal").members.find((m) => m.memberId === "m1")!.verdict).toBe("eligible");
  });
  it("tribe-specific scheme stays 'not eligible' for a non-ST family instead of nagging", () => {
    expect(get("mp-aahar-anudan").verdict).not.toBe("eligible");
  });
});

import { familyAlerts } from "@/lib/alerts";

describe("life-event alerts", () => {
  const fam: Family = {
    id: "f", code: "X",
    household: { state: "Madhya Pradesh", district: "Sehore", area: "rural", annualIncome: 120000, category: "obc", isBPL: true },
    members: [
      { id: "a", name: "सुनीता", relation: "self", isHead: true, status: "active", hasLogin: true, profile: { age: 39, gender: "female", maritalStatus: "widowed", occupation: "agri_labourer", hasBankAccount: true, isDisabled: false } },
      { id: "b", name: "गुड़िया", relation: "daughter", isHead: false, status: "active", hasLogin: false, profile: { age: 0, gender: "female", isDisabled: false } },
      { id: "c", name: "कविता", relation: "daughter", isHead: false, status: "active", hasLogin: false, profile: { age: 17, gender: "female", isStudent: true, studyLevel: "class_11_12", isDisabled: false } },
    ],
  };
  const fm = evaluateFamily(fam);
  const today = new Date("2026-10-01T00:00:00");
  it("warns about the 40th birthday, the newborn's Ladli Laxmi window, the widow pension and the Class 12 result", () => {
    const ids = familyAlerts(fam, fm, {}, today).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["p40-a", "ll-b", "kp-a", "c12-c"]));
  });
  it("urgent alerts come first", () => {
    const alerts = familyAlerts(fam, fm, {}, today);
    const firstCalm = alerts.findIndex((a) => !a.urgent);
    expect(alerts.slice(firstCalm).every((a) => !a.urgent)).toBe(true);
  });
  it("stops nagging once the benefit is marked as received", () => {
    const ids = familyAlerts(fam, fm, { "mp-kalyani-pension|a": "receiving", "mp-ladli-laxmi|b": "receiving" }, today).map((a) => a.id);
    expect(ids).not.toContain("kp-a");
    expect(ids).not.toContain("ll-b");
  });
});
