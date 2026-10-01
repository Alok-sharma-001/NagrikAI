import { HOUSEHOLD_FIELDS, type FamilyMatch } from "./family";
import { QUESTIONS } from "./questions";
import type { AskFor, ProfileField } from "./types";

/** The single most valuable unanswered question for the selected person (or whole family). */
export function nextQuestion(match: FamilyMatch, who: string): (AskFor & { memberId: string | null }) | null {
  const score = new Map<string, { field: ProfileField; memberId: string | null; w: number }>();
  for (const r of match.schemes) {
    const b = r.scheme.benefit;
    const weight = 1 + ((b.cashPerYear ?? 0) + (b.oneTime ?? 0)) / 50000;
    for (const m of r.members) {
      if ((who !== "all" && m.memberId !== who) || m.verdict !== "possible") continue;
      for (const f of new Set(m.unknown.map((u) => u.field))) {
        if (!QUESTIONS[f]) continue;
        const household = (HOUSEHOLD_FIELDS as readonly string[]).includes(f);
        const key = household ? `h:${f}` : `${m.memberId}:${f}`;
        const e = score.get(key) ?? { field: f, memberId: household ? null : m.memberId, w: 0 };
        e.w += weight;
        score.set(key, e);
      }
    }
  }
  const best = [...score.values()].sort((a, b) => b.w - a.w)[0];
  return best ? { field: best.field, memberId: best.memberId, ...QUESTIONS[best.field]! } : null;
}
