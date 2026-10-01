import "server-only";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Family, Household, Member, MemberProfile, Relation } from "@/lib/family";

/**
 * Storage for registered families. SQLite (built into Node) keeps the hackathon
 * setup dependency-free; the functions below are the only place that touches
 * SQL, so moving to Postgres later only changes this file.
 */

const DB_PATH = process.env.NAGRIK_DB || path.join(process.cwd(), "data", "runtime", "nagrik.db");

let db: DatabaseSync | null = null;
function conn(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      household TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      is_head INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      profile TEXT NOT NULL DEFAULT '{}',
      mobile TEXT UNIQUE,
      pin_hash TEXT,
      consent_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_tickets (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      tries INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheme_status (
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      scheme_id TEXT NOT NULL,
      member_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (family_id, scheme_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      scheme_id TEXT NOT NULL,
      district TEXT,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS officer_sessions (token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  `);
  // Samagra linking was added later: upgrade older database files in place.
  const cols = (table: string) => (db!.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  if (!cols("families").includes("samagra_id")) db.exec("ALTER TABLE families ADD COLUMN samagra_id TEXT");
  if (!cols("members").includes("samagra_member_id")) db.exec("ALTER TABLE members ADD COLUMN samagra_member_id TEXT");
  if (!cols("families").includes("demo")) db.exec("ALTER TABLE families ADD COLUMN demo INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS families_samagra ON families(samagra_id) WHERE samagra_id IS NOT NULL");
  return db;
}

/* ---------- PIN hashing ---------- */

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return salt.toString("hex") + ":" + scryptSync(pin, salt, 32).toString("hex");
}
export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const got = scryptSync(pin, Buffer.from(salt, "hex"), 32);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

/* ---------- Families & members ---------- */

// No 0/O, 1/I/L — easy to read out over the phone.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function newFamilyCode(): string {
  const bytes = randomBytes(6);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

type MemberRow = {
  id: string;
  family_id: string;
  name: string;
  relation: string;
  is_head: number;
  status: string;
  profile: string;
  mobile: string | null;
  pin_hash: string | null;
};

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  name: r.name,
  relation: r.relation as Relation,
  isHead: r.is_head === 1,
  status: r.status as Member["status"],
  hasLogin: r.mobile !== null,
  profile: JSON.parse(r.profile),
});

export function createFamily(args: {
  household: Household;
  head: { name: string; profile: MemberProfile; mobile: string; pin: string };
}): { family: Family; memberId: string } {
  const d = conn();
  const familyId = randomUUID();
  const memberId = randomUUID();
  const now = new Date().toISOString();
  let code = newFamilyCode();
  while (d.prepare("SELECT 1 FROM families WHERE code = ?").get(code)) code = newFamilyCode();
  d.exec("BEGIN");
  try {
    d.prepare("INSERT INTO families (id, code, household, created_at) VALUES (?, ?, ?, ?)").run(familyId, code, JSON.stringify(args.household), now);
    d.prepare(
      "INSERT INTO members (id, family_id, name, relation, is_head, status, profile, mobile, pin_hash, consent_at, created_at) VALUES (?, ?, ?, 'self', 1, 'active', ?, ?, ?, ?, ?)",
    ).run(memberId, familyId, args.head.name, JSON.stringify(args.head.profile), args.head.mobile, hashPin(args.head.pin), now, now);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return { family: getFamily(familyId)!, memberId };
}

export function getFamily(familyId: string): Family | null {
  const d = conn();
  const f = d.prepare("SELECT id, code, household, samagra_id FROM families WHERE id = ?").get(familyId) as
    | { id: string; code: string; household: string; samagra_id: string | null }
    | undefined;
  if (!f) return null;
  const rows = d.prepare("SELECT * FROM members WHERE family_id = ? ORDER BY is_head DESC, created_at").all(familyId) as MemberRow[];
  return { id: f.id, code: f.code, samagraId: f.samagra_id ?? undefined, household: JSON.parse(f.household), members: rows.map(toMember) };
}

/* ---------- Samagra-linked families ---------- */

export function findFamilyBySamagra(samagraId: string): { id: string } | null {
  return (conn().prepare("SELECT id FROM families WHERE samagra_id = ?").get(samagraId) as { id: string } | undefined) ?? null;
}

type SamagraMember = { samagraMemberId: string; name: string; relation: Relation; profile: MemberProfile };

/**
 * First member of a Samagra family to register: creates the family with EVERY
 * registry member in one go. The person registering gets the login and manages the family.
 */
export function createFamilyFromSamagra(args: {
  samagraId: string;
  household: Household;
  members: SamagraMember[];
  selfMemberId: string;
  mobile: string;
  pin: string;
}): { familyId: string; memberId: string } {
  const d = conn();
  const familyId = randomUUID();
  const now = new Date().toISOString();
  let code = newFamilyCode();
  while (d.prepare("SELECT 1 FROM families WHERE code = ?").get(code)) code = newFamilyCode();
  let selfId = "";
  d.exec("BEGIN");
  try {
    d.prepare("INSERT INTO families (id, code, household, samagra_id, created_at) VALUES (?, ?, ?, ?, ?)").run(familyId, code, JSON.stringify(args.household), args.samagraId, now);
    const ins = d.prepare(
      "INSERT INTO members (id, family_id, name, relation, is_head, status, profile, mobile, pin_hash, consent_at, samagra_member_id, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)",
    );
    for (const m of args.members) {
      const id = randomUUID();
      const self = m.samagraMemberId === args.selfMemberId;
      if (self) selfId = id;
      ins.run(id, familyId, m.name, m.relation, self ? 1 : 0, JSON.stringify(m.profile), self ? args.mobile : null, self ? hashPin(args.pin) : null, self ? now : null, m.samagraMemberId, now);
    }
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return { familyId, memberId: selfId };
}

/** A later member of an already-registered Samagra family: give their existing record a login. */
export function attachSamagraLogin(args: { familyId: string; samagraMemberId: string; profile: MemberProfile; mobile: string; pin: string }): string | null {
  const d = conn();
  const row = d.prepare("SELECT id, mobile FROM members WHERE family_id = ? AND samagra_member_id = ?").get(args.familyId, args.samagraMemberId) as
    | { id: string; mobile: string | null }
    | undefined;
  if (!row || row.mobile) return null; // unknown member, or already has a login
  d.prepare("UPDATE members SET profile = ?, mobile = ?, pin_hash = ?, consent_at = ?, status = 'active' WHERE id = ?").run(
    JSON.stringify(args.profile),
    args.mobile,
    hashPin(args.pin),
    new Date().toISOString(),
    row.id,
  );
  return row.id;
}

export function samagraMemberState(familyId: string, samagraMemberId: string): { profile: MemberProfile; hasLogin: boolean } | null {
  const r = conn().prepare("SELECT profile, mobile FROM members WHERE family_id = ? AND samagra_member_id = ?").get(familyId, samagraMemberId) as
    | { profile: string; mobile: string | null }
    | undefined;
  return r ? { profile: JSON.parse(r.profile), hasLogin: r.mobile !== null } : null;
}

export function findFamilyByCode(code: string): { id: string } | null {
  return (conn().prepare("SELECT id FROM families WHERE code = ?").get(code.toUpperCase().trim()) as { id: string } | undefined) ?? null;
}

export function mobileTaken(mobile: string): boolean {
  return !!conn().prepare("SELECT 1 FROM members WHERE mobile = ?").get(mobile);
}

export function addMember(args: {
  familyId: string;
  name: string;
  relation: Relation;
  profile: MemberProfile;
  status: Member["status"];
  login?: { mobile: string; pin: string };
}): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  conn()
    .prepare(
      "INSERT INTO members (id, family_id, name, relation, is_head, status, profile, mobile, pin_hash, consent_at, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      id,
      args.familyId,
      args.name,
      args.relation,
      args.status,
      JSON.stringify(args.profile),
      args.login?.mobile ?? null,
      args.login ? hashPin(args.login.pin) : null,
      args.login ? now : null,
      now,
    );
  return id;
}

export function updateMember(familyId: string, memberId: string, patch: { name?: string; relation?: Relation; profile?: MemberProfile; status?: Member["status"] }) {
  const d = conn();
  const row = d.prepare("SELECT * FROM members WHERE id = ? AND family_id = ?").get(memberId, familyId) as MemberRow | undefined;
  if (!row) return false;
  d.prepare("UPDATE members SET name = ?, relation = ?, profile = ?, status = ? WHERE id = ?").run(
    patch.name ?? row.name,
    patch.relation ?? row.relation,
    patch.profile ? JSON.stringify(patch.profile) : row.profile,
    patch.status ?? row.status,
    memberId,
  );
  return true;
}

export function deleteMember(familyId: string, memberId: string) {
  conn().prepare("DELETE FROM members WHERE id = ? AND family_id = ? AND is_head = 0").run(memberId, familyId);
}

export function updateHousehold(familyId: string, household: Household) {
  conn().prepare("UPDATE families SET household = ? WHERE id = ?").run(JSON.stringify(household), familyId);
}

export function deleteFamily(familyId: string) {
  conn().prepare("DELETE FROM families WHERE id = ?").run(familyId);
}

/* ---------- Sessions ---------- */

const SESSION_DAYS = 90;

export function findLogin(mobile: string): { memberId: string; pinHash: string } | null {
  const r = conn().prepare("SELECT id, pin_hash FROM members WHERE mobile = ?").get(mobile) as { id: string; pin_hash: string } | undefined;
  return r ? { memberId: r.id, pinHash: r.pin_hash } : null;
}

export function createSession(memberId: string): { token: string; expires: Date } {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  conn().prepare("INSERT INTO sessions (token, member_id, expires_at) VALUES (?, ?, ?)").run(token, memberId, expires.toISOString());
  return { token, expires };
}

export function sessionMember(token: string): { memberId: string; familyId: string; isHead: boolean; status: string } | null {
  const r = conn()
    .prepare(
      "SELECT m.id, m.family_id, m.is_head, m.status FROM sessions s JOIN members m ON m.id = s.member_id WHERE s.token = ? AND s.expires_at > ?",
    )
    .get(token, new Date().toISOString()) as { id: string; family_id: string; is_head: number; status: string } | undefined;
  return r ? { memberId: r.id, familyId: r.family_id, isHead: r.is_head === 1, status: r.status } : null;
}

export function deleteSession(token: string) {
  conn().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/* ---------- OTP tickets (kept in the database so every server instance sees them) ---------- */

export type OtpTicket = { id: string; familyId: string; memberId: string; otpHash: string; tries: number; verified: boolean; expiresAt: number };

export function saveOtpTicket(t: OtpTicket) {
  const d = conn();
  d.prepare("DELETE FROM otp_tickets WHERE expires_at < ?").run(Date.now());
  d.prepare("INSERT INTO otp_tickets (id, family_id, member_id, otp_hash, tries, verified, expires_at) VALUES (?, ?, ?, ?, 0, 0, ?)").run(t.id, t.familyId, t.memberId, t.otpHash, t.expiresAt);
}

export function getOtpTicket(id: string): OtpTicket | null {
  const r = conn().prepare("SELECT * FROM otp_tickets WHERE id = ?").get(id) as
    | { id: string; family_id: string; member_id: string; otp_hash: string; tries: number; verified: number; expires_at: number }
    | undefined;
  return r ? { id: r.id, familyId: r.family_id, memberId: r.member_id, otpHash: r.otp_hash, tries: r.tries, verified: r.verified === 1, expiresAt: r.expires_at } : null;
}

export function bumpOtpTries(id: string) {
  conn().prepare("UPDATE otp_tickets SET tries = tries + 1 WHERE id = ?").run(id);
}
export function markOtpVerified(id: string) {
  conn().prepare("UPDATE otp_tickets SET verified = 1 WHERE id = ?").run(id);
}
export function deleteOtpTicket(id: string) {
  conn().prepare("DELETE FROM otp_tickets WHERE id = ?").run(id);
}

/* ---------- Benefit status: receiving / applied / rejected ---------- */

export type BenefitStatus = "receiving" | "applied" | "rejected";
/** Key: `${schemeId}|${memberId}` — memberId is "" for family-level schemes. */
export type StatusMap = Record<string, BenefitStatus>;

export function setBenefitStatus(familyId: string, schemeId: string, memberId: string, status: BenefitStatus | null) {
  const d = conn();
  if (status === null) d.prepare("DELETE FROM scheme_status WHERE family_id = ? AND scheme_id = ? AND member_id = ?").run(familyId, schemeId, memberId);
  else
    d.prepare(
      "INSERT INTO scheme_status (family_id, scheme_id, member_id, status, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(family_id, scheme_id, member_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
    ).run(familyId, schemeId, memberId, status, new Date().toISOString());
}

export function getBenefitStatuses(familyId: string): StatusMap {
  const rows = conn().prepare("SELECT scheme_id, member_id, status FROM scheme_status WHERE family_id = ?").all(familyId) as { scheme_id: string; member_id: string; status: BenefitStatus }[];
  return Object.fromEntries(rows.map((r) => [`${r.scheme_id}|${r.member_id}`, r.status]));
}

/* ---------- Officer side: every family, for aggregate dashboards ---------- */

export function allFamilies(): { family: Family; statuses: StatusMap; demo: boolean }[] {
  const d = conn();
  const fams = d.prepare("SELECT id, code, household, samagra_id, demo FROM families").all() as { id: string; code: string; household: string; samagra_id: string | null; demo: number }[];
  const members = d.prepare("SELECT * FROM members ORDER BY is_head DESC, created_at").all() as MemberRow[];
  const statuses = d.prepare("SELECT family_id, scheme_id, member_id, status FROM scheme_status").all() as { family_id: string; scheme_id: string; member_id: string; status: BenefitStatus }[];
  const byFamily = new Map<string, MemberRow[]>();
  for (const m of members) byFamily.set(m.family_id, [...(byFamily.get(m.family_id) ?? []), m]);
  const stByFamily = new Map<string, StatusMap>();
  for (const s of statuses) stByFamily.set(s.family_id, { ...(stByFamily.get(s.family_id) ?? {}), [`${s.scheme_id}|${s.member_id}`]: s.status });
  return fams.map((f) => ({
    family: { id: f.id, code: f.code, samagraId: f.samagra_id ?? undefined, household: JSON.parse(f.household), members: (byFamily.get(f.id) ?? []).map(toMember) },
    statuses: stByFamily.get(f.id) ?? {},
    demo: f.demo === 1,
  }));
}

/** Insert synthetic families for demonstrations; flagged so they can be removed in one go. */
export function insertDemoFamilies(items: { household: Household; members: { name: string; relation: Relation; profile: MemberProfile }[]; statuses: { schemeId: string; memberIndex: number | null; status: BenefitStatus }[] }[]) {
  const d = conn();
  const now = new Date().toISOString();
  const insF = d.prepare("INSERT INTO families (id, code, household, demo, created_at) VALUES (?, ?, ?, 1, ?)");
  const insM = d.prepare("INSERT INTO members (id, family_id, name, relation, is_head, status, profile, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)");
  const insS = d.prepare("INSERT OR REPLACE INTO scheme_status (family_id, scheme_id, member_id, status, updated_at) VALUES (?, ?, ?, ?, ?)");
  d.exec("BEGIN");
  try {
    for (const it of items) {
      const fid = randomUUID();
      insF.run(fid, "D" + randomBytes(5).toString("hex").toUpperCase(), JSON.stringify(it.household), now);
      const ids = it.members.map((m, i) => {
        const id = randomUUID();
        insM.run(id, fid, m.name, m.relation, i === 0 ? 1 : 0, JSON.stringify(m.profile), now);
        return id;
      });
      for (const s of it.statuses) insS.run(fid, s.schemeId, s.memberIndex === null ? "" : ids[s.memberIndex], s.status, now);
    }
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function clearDemoFamilies(): number {
  return Number(conn().prepare("DELETE FROM families WHERE demo = 1").run().changes);
}

/* ---------- "Report wrong information" ---------- */

export function addFeedback(schemeId: string, district: string | undefined, note: string) {
  conn().prepare("INSERT INTO feedback (id, scheme_id, district, note, created_at) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), schemeId, district ?? null, note, new Date().toISOString());
}
export function listFeedback(limit = 50) {
  return conn().prepare("SELECT scheme_id, district, note, created_at FROM feedback ORDER BY created_at DESC LIMIT ?").all(limit) as { scheme_id: string; district: string | null; note: string; created_at: string }[];
}

/* ---------- Officer sessions ---------- */

export function createOfficerSession(): { token: string; expires: Date } {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 12 * 3600_000);
  const d = conn();
  d.prepare("DELETE FROM officer_sessions WHERE expires_at < ?").run(Date.now());
  d.prepare("INSERT INTO officer_sessions (token, expires_at) VALUES (?, ?)").run(token, expires.getTime());
  return { token, expires };
}
export function officerSessionValid(token: string): boolean {
  return !!conn().prepare("SELECT 1 FROM officer_sessions WHERE token = ? AND expires_at > ?").get(token, Date.now());
}
