// Validates the scheme knowledge base. Run: npm run kb:check
import { readFileSync, readdirSync } from "node:fs";

const FIELDS = new Set(
  readFileSync("lib/types.ts", "utf8")
    .match(/export type Profile = \{([\s\S]*?)\n\};/)[1]
    .matchAll(/^\s+(\w+)\?:/gm)
    .map((m) => m[1]),
);
const OPS = new Set(["eq", "neq", "in", "nin", "lt", "lte", "gt", "gte", "between", "true", "false"]);
// Official domains, plus a few official scheme portals that aren't on .gov.in.
const OFFICIAL = /\.(gov\.in|nic\.in)(\/|$)|\/\/(www\.)?(nabard\.org|mudra\.org\.in|standupmitra\.in|jansamarth\.in|pfrda\.org\.in|maandhan\.in|poshantracker\.in)(\/|$)/;

const docs = new Set(JSON.parse(readFileSync("data/documents.json", "utf8")).map((d) => d.id));
const schemes = readdirSync("data/schemes").flatMap((f) => JSON.parse(readFileSync(`data/schemes/${f}`, "utf8")).map((s) => ({ ...s, _file: f })));

const errors = [];
const err = (s, msg) => errors.push(`${s._file} › ${s.id}: ${msg}`);
const ids = new Set();

function checkRule(s, r) {
  if (r.all || r.any) return (r.all ?? r.any).forEach((x) => checkRule(s, x));
  if (!FIELDS.has(r.field)) err(s, `unknown field "${r.field}"`);
  if (!OPS.has(r.op)) err(s, `unknown op "${r.op}"`);
  if (["in", "nin"].includes(r.op) && !Array.isArray(r.value)) err(s, `${r.op} needs an array`);
  if (r.op === "between" && !(Array.isArray(r.value) && r.value.length === 2)) err(s, "between needs [min, max]");
}

for (const s of schemes) {
  if (ids.has(s.id)) err(s, "duplicate id");
  ids.add(s.id);
  for (const k of ["name", "summary", "benefit", "howToApply"]) if (!s[k]?.en || !s[k]?.hi) err(s, `${k} needs en + hi`);
  if (!s.deadline?.note?.en || !s.deadline?.note?.hi) err(s, "deadline.note needs en + hi");
  checkRule(s, s.eligibility);
  for (const d of s.documents) if (!docs.has(d)) err(s, `unknown document "${d}"`);
  for (const u of [s.applyUrl, s.sourceUrl]) if (!OFFICIAL.test(u)) err(s, `non-official URL ${u}`);
}

const unreviewed = schemes.filter((s) => !s.reviewedOn);
console.log(`${schemes.length} schemes, ${docs.size} documents.`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n  ` + errors.join("\n  "));
} else console.log("No structural errors.");
console.log(`\n${unreviewed.length} scheme(s) not yet reviewed against their official source (set "reviewedOn"):`);
console.log("  " + unreviewed.map((s) => s.id).join(", "));
process.exit(errors.length ? 1 : 0);
