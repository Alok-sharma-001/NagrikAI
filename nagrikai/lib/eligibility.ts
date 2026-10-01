import { leafLabel } from "./labels";
import { normalizeProfile } from "./profile";
import type { Leaf, LeafResult, MatchResult, Profile, Rule, Scheme, Tri, Verdict } from "./types";

type Eval = { result: Tri; leaves: LeafResult[] };

const isLeaf = (r: Rule): r is Leaf => "field" in r;

function evalLeaf(leaf: Leaf, p: Profile): Tri {
  const v = p[leaf.field];
  if (v === undefined || v === null) return "unknown";
  const t = leaf.value;
  switch (leaf.op) {
    case "true":
      return v === true ? "pass" : "fail";
    case "false":
      return v === false ? "pass" : "fail";
    case "eq":
      return v === t ? "pass" : "fail";
    case "neq":
      return v !== t ? "pass" : "fail";
    case "in":
      return (t as unknown[]).includes(v) ? "pass" : "fail";
    case "nin":
      return (t as unknown[]).includes(v) ? "fail" : "pass";
    case "lt":
      return (v as number) < (t as number) ? "pass" : "fail";
    case "lte":
      return (v as number) <= (t as number) ? "pass" : "fail";
    case "gt":
      return (v as number) > (t as number) ? "pass" : "fail";
    case "gte":
      return (v as number) >= (t as number) ? "pass" : "fail";
    case "between": {
      const [a, b] = t as [number, number];
      return (v as number) >= a && (v as number) <= b ? "pass" : "fail";
    }
  }
}

function evalRule(rule: Rule, p: Profile): Eval {
  if (isLeaf(rule)) {
    const result = evalLeaf(rule, p);
    return { result, leaves: [{ field: rule.field, label: leafLabel(rule), result }] };
  }
  if ("all" in rule) {
    const parts = rule.all.map((r) => evalRule(r, p));
    const result: Tri = parts.some((x) => x.result === "fail")
      ? "fail"
      : parts.some((x) => x.result === "unknown")
        ? "unknown"
        : "pass";
    return { result, leaves: parts.flatMap((x) => x.leaves) };
  }
  const parts = rule.any.map((r) => evalRule(r, p));
  const passing = parts.find((x) => x.result === "pass");
  // For a satisfied "any", report only the branch that satisfied it.
  if (passing) return { result: "pass", leaves: passing.leaves.filter((l) => l.result === "pass") };
  const result: Tri = parts.some((x) => x.result === "unknown") ? "unknown" : "fail";
  return { result, leaves: parts.flatMap((x) => x.leaves) };
}

const VERDICT: Record<Tri, Verdict> = { pass: "eligible", unknown: "possible", fail: "ineligible" };

export function evaluateScheme(scheme: Scheme, profile: Profile): MatchResult {
  const p = normalizeProfile(profile);
  const { result, leaves } = evalRule(scheme.eligibility, p);
  return {
    scheme,
    verdict: VERDICT[result],
    matched: leaves.filter((l) => l.result === "pass"),
    failed: leaves.filter((l) => l.result === "fail"),
    unknown: leaves.filter((l) => l.result === "unknown"),
  };
}

const value = (s: Scheme) => (s.benefit.cashPerYear ?? 0) + (s.benefit.oneTime ?? 0);

export function evaluateAll(schemes: Scheme[], profile: Profile) {
  const results = schemes.map((s) => evaluateScheme(s, profile));
  const eligible = results
    .filter((r) => r.verdict === "eligible")
    .sort(
      (a, b) =>
        value(b.scheme) - value(a.scheme) ||
        (b.scheme.benefit.cover ?? 0) - (a.scheme.benefit.cover ?? 0) ||
        a.scheme.name.en.localeCompare(b.scheme.name.en),
    );
  const possible = results
    .filter((r) => r.verdict === "possible")
    .sort((a, b) => new Set(a.unknown.map((u) => u.field)).size - new Set(b.unknown.map((u) => u.field)).size);
  const ineligible = results.filter((r) => r.verdict === "ineligible");
  // Schemes not taking new registrations are shown, but never counted as money the person "can get".
  const totals = eligible.filter((r) => !r.scheme.intakeClosed && !r.scheme.eventBased).reduce(
    (t, r) => ({
      cashPerYear: t.cashPerYear + (r.scheme.benefit.cashPerYear ?? 0),
      oneTime: t.oneTime + (r.scheme.benefit.oneTime ?? 0),
      cover: t.cover + (r.scheme.benefit.cover ?? 0),
    }),
    { cashPerYear: 0, oneTime: 0, cover: 0 },
  );
  return { eligible, possible, ineligible, totals };
}
