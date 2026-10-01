import { eligibleUnits, evaluateFamily, type Family } from "./family";
import { getDocument } from "./kb";
import type { Scheme, Text } from "./types";

/**
 * Officer view: the same rules engine, run over every registered family, to answer
 * "who is eligible but not yet receiving?" — the saturation gap. Aggregates only;
 * the export carries no names.
 */

export type Status = "receiving" | "applied" | "rejected";
export type FamilyRecord = { family: Family; statuses: Record<string, Status>; demo: boolean };

export type SchemeGap = {
  id: string;
  name: Text;
  scope: "central" | "mp";
  intakeClosed: boolean;
  eligible: number;
  receiving: number;
  applied: number;
  rejected: number;
  gap: number;
  /** Yearly cash not reaching eligible people (0 for schemes without a cash value). */
  unclaimedPerYear: number;
};
export type DistrictRow = { district: string; families: number; members: number; eligible: number; receiving: number; gap: number };
export type GapRow = { district: string; area: string; familyRef: string; schemeId: string; scheme: string; age: number | ""; gender: string; status: string };

export type OfficerSummary = {
  districts: string[];
  totals: { families: number; demoFamilies: number; members: number; eligible: number; receiving: number; applied: number; gap: number; unclaimedPerYear: number };
  schemes: SchemeGap[];
  byDistrict: DistrictRow[];
  topDocuments: { name: Text; count: number }[];
};

const countable = (s: Scheme) => !s.eventBased;

export function summarize(records: FamilyRecord[], district?: string): { summary: OfficerSummary; rows: GapRow[] } {
  const districts = [...new Set(records.map((r) => r.family.household.district).filter((d): d is string => !!d))].sort();
  const inScope = records.filter((r) => !district || r.family.household.district === district);

  const schemes = new Map<string, SchemeGap>();
  const byDistrict = new Map<string, DistrictRow>();
  const docs = new Map<string, number>();
  const rows: GapRow[] = [];
  const totals = { families: inScope.length, demoFamilies: inScope.filter((r) => r.demo).length, members: 0, eligible: 0, receiving: 0, applied: 0, gap: 0, unclaimedPerYear: 0 };

  for (const rec of inScope) {
    const { family, statuses } = rec;
    const d = family.household.district ?? "—";
    const dist = byDistrict.get(d) ?? { district: d, families: 0, members: 0, eligible: 0, receiving: 0, gap: 0 };
    const active = family.members.filter((m) => m.status === "active");
    dist.families++;
    dist.members += active.length;
    totals.members += active.length;

    for (const u of eligibleUnits(evaluateFamily(family)).filter((x) => countable(x.scheme))) {
      const st = statuses[`${u.scheme.id}|${u.memberId}`];
      const g = schemes.get(u.scheme.id) ?? {
        id: u.scheme.id, name: u.scheme.name, scope: u.scheme.scope ?? "central", intakeClosed: !!u.scheme.intakeClosed,
        eligible: 0, receiving: 0, applied: 0, rejected: 0, gap: 0, unclaimedPerYear: 0,
      };
      g.eligible++; dist.eligible++; totals.eligible++;
      if (st === "receiving") { g.receiving++; dist.receiving++; totals.receiving++; }
      else {
        if (st === "applied") { g.applied++; totals.applied++; }
        if (st === "rejected") g.rejected++;
        // Applied-but-not-yet-receiving still counts as a gap: the benefit hasn't reached them.
        g.gap++; dist.gap++; totals.gap++;
        const cash = u.scheme.benefit.cashPerYear ?? 0;
        g.unclaimedPerYear += cash; totals.unclaimedPerYear += cash;
        for (const doc of u.scheme.documents) docs.set(doc, (docs.get(doc) ?? 0) + 1);
        const m = active.find((x) => x.id === u.memberId) ?? active[0];
        rows.push({
          district: d,
          area: family.household.area ?? "",
          familyRef: family.samagraId ? `SAMAGRA-••••${family.samagraId.slice(-4)}` : family.code,
          schemeId: u.scheme.id,
          scheme: u.scheme.name.en,
          age: u.memberId ? (m?.profile.age ?? "") : "",
          gender: u.memberId ? (m?.profile.gender ?? "") : "family",
          status: st ?? "not applied",
        });
      }
      schemes.set(u.scheme.id, g);
    }
    byDistrict.set(d, dist);
  }

  return {
    summary: {
      districts,
      totals,
      schemes: [...schemes.values()].sort((a, b) => b.gap - a.gap),
      byDistrict: [...byDistrict.values()].sort((a, b) => b.gap / Math.max(1, b.eligible) - a.gap / Math.max(1, a.eligible)),
      topDocuments: [...docs.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, count]) => ({ name: getDocument(id)?.name ?? { en: id, hi: id }, count })),
    },
    rows,
  };
}

export function rowsToCsv(rows: GapRow[]): string {
  const head = ["district", "area", "family_ref", "scheme_id", "scheme", "member_age", "member_gender", "status"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((r) => [r.district, r.area, r.familyRef, r.schemeId, r.scheme, r.age, r.gender, r.status].map(esc).join(","))].join("\n");
}
