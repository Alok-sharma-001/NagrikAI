import { evaluateAll } from "./eligibility";
import { getDocument, SCHEMES } from "./kb";
import { QUESTIONS } from "./questions";
import type { AskFor, ChecklistItem, MatchResponse, MatchResult, Profile, ProfileField, Reminder } from "./types";

/** Union of documents across eligible schemes, most-needed first. */
export function buildChecklist(eligible: MatchResult[]): ChecklistItem[] {
  const map = new Map<string, string[]>();
  for (const r of eligible) {
    for (const d of r.scheme.documents) map.set(d, [...(map.get(d) ?? []), r.scheme.id]);
  }
  return [...map.entries()]
    .map(([id, neededFor]) => ({ doc: getDocument(id)!, neededFor }))
    .filter((x) => x.doc)
    .sort((a, b) => b.neededFor.length - a.neededFor.length);
}

/** Next occurrence of a month/day on or after `from`. */
function nextDate(month: number, day: number, from: Date): string {
  let y = from.getFullYear();
  const candidate = (yr: number) => new Date(Date.UTC(yr, month - 1, day));
  if (candidate(y).getTime() < Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) y += 1;
  return candidate(y).toISOString().slice(0, 10);
}

export function buildReminders(results: MatchResult[], from = new Date()): Reminder[] {
  return results
    .map((r): Reminder => {
      const d = r.scheme.deadline;
      return {
        schemeId: r.scheme.id,
        date: d.month && d.day ? nextDate(d.month, d.day, from) : null,
        title: r.scheme.name,
        note: d.note,
      };
    })
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

/**
 * Pick the unknown fields worth asking next: each "possible" scheme votes for its
 * unknown fields, weighted by 1 + (cash + one-time value) / ₹50,000.
 */
export function pickQuestions(possible: MatchResult[], limit = 3, skip: ProfileField[] = []): AskFor[] {
  const count = new Map<ProfileField, number>();
  for (const r of possible) {
    const b = r.scheme.benefit;
    const weight = 1 + ((b.cashPerYear ?? 0) + (b.oneTime ?? 0)) / 50000;
    for (const f of new Set(r.unknown.map((u) => u.field))) count.set(f, (count.get(f) ?? 0) + weight);
  }
  return [...count.entries()]
    .filter(([f]) => QUESTIONS[f] && !skip.includes(f))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([field]) => ({ field, ...QUESTIONS[field]! }));
}

export function match(profile: Profile, opts: { skip?: ProfileField[] } = {}): MatchResponse {
  const { eligible, possible, ineligible, totals } = evaluateAll(SCHEMES, profile);
  return {
    eligible,
    possible,
    ineligible,
    totals,
    checklist: buildChecklist(eligible),
    reminders: buildReminders([...eligible, ...possible.slice(0, 5)]),
    askFor: pickQuestions(possible, 3, opts.skip),
  };
}
