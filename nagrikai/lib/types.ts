export type Lang = "en" | "hi";
export type Text = { en: string; hi: string };

export const OCCUPATIONS = [
  "farmer",
  "agri_labourer",
  "construction_worker",
  "domestic_worker",
  "street_vendor",
  "artisan",
  "fisherman",
  "student",
  "unemployed",
  "salaried_private",
  "govt_employee",
  "self_employed",
  "homemaker",
  "retired",
  "other",
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

export const STUDY_LEVELS = ["class_1_8", "class_9_10", "class_11_12", "diploma", "ug", "pg"] as const;
export type StudyLevel = (typeof STUDY_LEVELS)[number];

export type Profile = {
  name?: string;
  age?: number;
  gender?: "male" | "female" | "transgender";
  state?: string;
  /** District of Madhya Pradesh (used for local offices and officer dashboards, not for eligibility). */
  district?: string;
  area?: "rural" | "urban";
  annualIncome?: number;
  category?: "general" | "obc" | "sc" | "st" | "ews";
  isMinority?: boolean;
  /** Particularly Vulnerable Tribal Group — in MP: Baiga, Bharia or Saharia. */
  isPVTG?: boolean;
  maritalStatus?: "single" | "married" | "widowed" | "divorced";
  occupation?: Occupation;
  isBPL?: boolean;
  isDisabled?: boolean;
  disabilityPercent?: number;
  landHectares?: number;
  ownsPuccaHouse?: boolean;
  hasLpgConnection?: boolean;
  hasToilet?: boolean;
  hasBankAccount?: boolean;
  isIncomeTaxPayer?: boolean;
  isGovtEmployee?: boolean;
  isEpfoMember?: boolean;
  isPregnantOrLactating?: boolean;
  hasChildUnder6?: boolean;
  hasSchoolChildren?: boolean;
  hasGirlChildUnder10?: boolean;
  isStudent?: boolean;
  studyLevel?: StudyLevel;
  wantsToStartBusiness?: boolean;
  breadwinnerDiedRecently?: boolean;
};
export type ProfileField = keyof Profile;

export type Op = "eq" | "neq" | "in" | "nin" | "lt" | "lte" | "gt" | "gte" | "between" | "true" | "false";

export type Leaf = { field: ProfileField; op: Op; value?: unknown; label?: Text };
export type Rule = { all: Rule[] } | { any: Rule[] } | Leaf;

export type Category =
  | "health"
  | "housing"
  | "pension"
  | "education"
  | "agriculture"
  | "employment"
  | "women_child"
  | "financial_inclusion"
  | "insurance"
  | "food"
  | "skill"
  | "business"
  | "disability"
  | "sanitation"
  | "energy";

export type Deadline = {
  type: "rolling" | "annual" | "renewal";
  month?: number;
  day?: number;
  note: Text;
};

export type Scheme = {
  id: string;
  /** "household": one benefit per family (ration, house, LPG…); default "individual": per eligible member. */
  level?: "household" | "individual";
  /** Who runs it: Government of India ("central", default) or Government of Madhya Pradesh ("mp"). */
  scope?: "central" | "mp";
  /** True when the scheme pays existing beneficiaries but is not taking new registrations right now. */
  intakeClosed?: boolean;
  /** Set when the benefit is paid only on a life event (e.g. marriage) — shown as a tag, never added to yearly totals. */
  eventBased?: Text;
  /** Schemes sharing a group are alternatives for one person (only one can be taken) — totals count the best one. */
  altGroup?: string;
  name: Text;
  ministry: string;
  category: Category;
  summary: Text;
  benefit: Text & { cashPerYear?: number; oneTime?: number; cover?: number };
  eligibility: Rule;
  /** Conditions the engine cannot check from the profile (shown to the user as "also required"). */
  alsoRequired?: Text[];
  documents: string[];
  howToApply: Text;
  applyUrl: string;
  sourceUrl: string;
  helpline: string | null;
  deadline: Deadline;
  stateNote?: Text;
  /** True when the state note describes a state scheme that may cover people this central scheme excludes. */
  stateAlternative?: boolean;
  reviewedOn: string | null;
};

export type DocumentInfo = { id: string; name: Text; where: Text };

export type Tri = "pass" | "fail" | "unknown";
export type Verdict = "eligible" | "possible" | "ineligible";

export type LeafResult = { field: ProfileField; label: Text; result: Tri };

export type MatchResult = {
  scheme: Scheme;
  verdict: Verdict;
  matched: LeafResult[];
  failed: LeafResult[];
  unknown: LeafResult[];
};

export type ChecklistItem = { doc: DocumentInfo; neededFor: string[] };

export type Reminder = { schemeId: string; date: string | null; title: Text; note: Text };

export type AskFor = { field: ProfileField; question: Text; options: { value: unknown; label: Text }[] };

export type MatchResponse = {
  eligible: MatchResult[];
  possible: MatchResult[];
  ineligible: MatchResult[];
  totals: { cashPerYear: number; oneTime: number; cover: number };
  checklist: ChecklistItem[];
  reminders: Reminder[];
  askFor: AskFor[];
};
