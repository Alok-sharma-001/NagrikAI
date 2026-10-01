"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Family, FamilyMatch, FamilySchemeResult, Member } from "@/lib/family";
import type { Verdict } from "@/lib/types";

export type BenefitStatus = "receiving" | "applied" | "rejected";
export type FamilyData = {
  me: { id: string; isHead: boolean; status: "active" | "pending" };
  family: Family;
  match: FamilyMatch;
  /** Key `${schemeId}|${memberId}` ("" member = whole family). */
  statuses: Record<string, BenefitStatus>;
};

type Ctx = { data: FamilyData | null; refresh: () => Promise<void> };
const FamilyContext = createContext<Ctx | null>(null);

/** Loads the logged-in family once for all pages; sends logged-out users to the start page. */
export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<FamilyData | null>(null);
  const refresh = useCallback(async () => {
    const res = await fetch("/api/family", { cache: "no-store" });
    if (res.status === 401) return router.replace("/");
    if (res.ok) setData(await res.json());
  }, [router]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <FamilyContext.Provider value={{ data, refresh }}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const c = useContext(FamilyContext);
  if (!c) throw new Error("useFamily outside FamilyProvider");
  return c;
}

/** Verdict of a scheme for the selected person ("all" = best across the family). */
export function verdictFor(r: FamilySchemeResult, who: string): Verdict {
  return who === "all" ? r.verdict : (r.members.find((m) => m.memberId === who)?.verdict ?? "ineligible");
}

export function memberIcon(m: Member): string {
  const age = m.profile.age ?? 30;
  const f = m.profile.gender === "female";
  if (age < 13) return f ? "👧" : "👦";
  if (age >= 60) return f ? "👵" : "👴";
  return f ? "👩" : "👨";
}
