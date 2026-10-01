import { RELATION_NAMES, RELATIONS, type Relation } from "./family";
import { VALUE_NAMES } from "./labels";
import type { Profile, Text } from "./types";

/**
 * Registration questions — one per screen, big pictures, read aloud.
 * The same list serves four flows; `when` hides questions that don't apply,
 * so a child is never asked about their job and a joiner never re-enters
 * household facts.
 */

export type WizardMode = "new" | "join" | "member" | "household" | "edit";

export type Answers = Profile & {
  relation?: Relation;
  code?: string;
  mobile?: string;
  pin?: string;
  consent?: boolean;
  study?: string; // "none" or a StudyLevel
  ration?: "priority" | "general" | "none";
  house?: "pucca" | "kutcha" | "rented" | "none";
  income?: number; // monthly
};

export type Option = { value: string | number | boolean; label: Text; icon: string };

export type Step = {
  id: keyof Answers;
  kind: "choice" | "number" | "text" | "code" | "mobile" | "pin" | "consent";
  icon: string;
  question: Text;
  hint?: Text;
  options?: Option[];
  /** Extractor field used to interpret a spoken answer. */
  voiceField?: keyof Profile;
  optional?: boolean;
  min?: number;
  max?: number;
  when?: (a: Answers, mode: WizardMode) => boolean;
};

const yesNo = (yesIcon = "✅", noIcon = "❌"): Option[] => [
  { value: true, label: { en: "Yes", hi: "हाँ" }, icon: yesIcon },
  { value: false, label: { en: "No", hi: "नहीं" }, icon: noIcon },
];
const opt = (value: string, icon: string): Option => ({ value, icon, label: VALUE_NAMES[value] });

const HOUSEHOLD_MODES: WizardMode[] = ["new", "household"];
const PERSON_MODES: WizardMode[] = ["new", "join", "member", "edit"];
const ACCOUNT_MODES: WizardMode[] = ["new", "join"];
const isAdult = (a: Answers) => (a.age ?? 0) >= 18;
const inMode = (modes: WizardMode[]) => (_a: Answers, m: WizardMode) => modes.includes(m);
const both =
  (...fs: ((a: Answers, m: WizardMode) => boolean)[]) =>
  (a: Answers, m: WizardMode) =>
    fs.every((f) => f(a, m));

export const MP_DISTRICTS: { en: string; hi: string }[] = [
  { en: "Agar Malwa", hi: "आगर मालवा" },
  { en: "Alirajpur", hi: "अलीराजपुर" },
  { en: "Anuppur", hi: "अनूपपुर" },
  { en: "Ashoknagar", hi: "अशोकनगर" },
  { en: "Balaghat", hi: "बालाघाट" },
  { en: "Barwani", hi: "बड़वानी" },
  { en: "Betul", hi: "बैतूल" },
  { en: "Bhind", hi: "भिंड" },
  { en: "Bhopal", hi: "भोपाल" },
  { en: "Burhanpur", hi: "बुरहानपुर" },
  { en: "Chhatarpur", hi: "छतरपुर" },
  { en: "Chhindwara", hi: "छिंदवाड़ा" },
  { en: "Damoh", hi: "दमोह" },
  { en: "Datia", hi: "दतिया" },
  { en: "Dewas", hi: "देवास" },
  { en: "Dhar", hi: "धार" },
  { en: "Dindori", hi: "डिंडोरी" },
  { en: "Guna", hi: "गुना" },
  { en: "Gwalior", hi: "ग्वालियर" },
  { en: "Harda", hi: "हरदा" },
  { en: "Indore", hi: "इंदौर" },
  { en: "Jabalpur", hi: "जबलपुर" },
  { en: "Jhabua", hi: "झाबुआ" },
  { en: "Katni", hi: "कटनी" },
  { en: "Khandwa", hi: "खंडवा" },
  { en: "Khargone", hi: "खरगोन" },
  { en: "Maihar", hi: "मैहर" },
  { en: "Mandla", hi: "मंडला" },
  { en: "Mandsaur", hi: "मंदसौर" },
  { en: "Mauganj", hi: "मऊगंज" },
  { en: "Morena", hi: "मुरैना" },
  { en: "Narmadapuram", hi: "नर्मदापुरम" },
  { en: "Narsinghpur", hi: "नरसिंहपुर" },
  { en: "Neemuch", hi: "नीमच" },
  { en: "Niwari", hi: "निवाड़ी" },
  { en: "Pandhurna", hi: "पांढुर्ना" },
  { en: "Panna", hi: "पन्ना" },
  { en: "Raisen", hi: "रायसेन" },
  { en: "Rajgarh", hi: "राजगढ़" },
  { en: "Ratlam", hi: "रतलाम" },
  { en: "Rewa", hi: "रीवा" },
  { en: "Sagar", hi: "सागर" },
  { en: "Satna", hi: "सतना" },
  { en: "Sehore", hi: "सीहोर" },
  { en: "Seoni", hi: "सिवनी" },
  { en: "Shahdol", hi: "शहडोल" },
  { en: "Shajapur", hi: "शाजापुर" },
  { en: "Sheopur", hi: "श्योपुर" },
  { en: "Shivpuri", hi: "शिवपुरी" },
  { en: "Sidhi", hi: "सीधी" },
  { en: "Singrauli", hi: "सिंगरौली" },
  { en: "Tikamgarh", hi: "टीकमगढ़" },
  { en: "Ujjain", hi: "उज्जैन" },
  { en: "Umaria", hi: "उमरिया" },
  { en: "Vidisha", hi: "विदिशा" },
];

export const STEPS: Step[] = [
  {
    id: "code", kind: "code", icon: "🔑", when: inMode(["join"]),
    question: { en: "Enter your family code", hi: "अपना परिवार कोड डालें" },
    hint: { en: "The person who registered your family can see it in the app", hi: "जिसने परिवार का पंजीकरण किया है, वह इसे ऐप में देख सकते हैं" },
  },
  {
    id: "name", kind: "text", icon: "🙋", when: inMode(PERSON_MODES),
    question: { en: "What is the name?", hi: "नाम क्या है?" },
    hint: { en: "Tap the mic and say the name", hi: "माइक दबाएँ और नाम बोलें" },
  },
  {
    id: "relation", kind: "choice", icon: "👨‍👩‍👧", when: inMode(["join", "member"]),
    question: { en: "How is this person related to the family head?", hi: "परिवार के मुखिया से क्या रिश्ता है?" },
    options: RELATIONS.filter((r) => r !== "self").map((r) => ({ value: r, icon: RELATION_NAMES[r].icon, label: RELATION_NAMES[r] })),
  },
  {
    id: "gender", kind: "choice", icon: "🧑", voiceField: "gender", when: inMode(PERSON_MODES),
    question: { en: "Man or woman?", hi: "पुरुष या महिला?" },
    options: [opt("female", "👩"), opt("male", "👨"), opt("transgender", "🧑")],
  },
  {
    id: "age", kind: "number", icon: "🎂", voiceField: "age", min: 0, max: 110, when: inMode(PERSON_MODES),
    question: { en: "How old?", hi: "उम्र कितनी है?" },
    hint: { en: "In years", hi: "सालों में" },
  },
  {
    id: "maritalStatus", kind: "choice", icon: "💍", voiceField: "maritalStatus",
    when: both(inMode(PERSON_MODES), isAdult),
    question: { en: "Married?", hi: "शादी हुई है?" },
    options: [opt("married", "💑"), opt("single", "🧍"), opt("widowed", "🕊️"), opt("divorced", "💔")],
  },
  {
    id: "occupation", kind: "choice", icon: "🧰", voiceField: "occupation",
    when: both(inMode(PERSON_MODES), (a) => (a.age ?? 18) >= 15),
    question: { en: "What work do you do?", hi: "क्या काम करते हैं?" },
    options: [
      opt("farmer", "🌾"), opt("agri_labourer", "👩‍🌾"), opt("construction_worker", "🏗️"), opt("domestic_worker", "🧹"),
      opt("street_vendor", "🛒"), opt("artisan", "🪡"), opt("self_employed", "🏪"), opt("salaried_private", "🏢"),
      opt("govt_employee", "🏛️"), opt("student", "🎓"), opt("homemaker", "🏠"), opt("unemployed", "🔍"),
      opt("fisherman", "🎣"), opt("retired", "👴"), opt("other", "❓"),
    ],
  },
  {
    id: "study", kind: "choice", icon: "🎓",
    when: both(inMode(PERSON_MODES), (a) => (a.age ?? 99) >= 4 && (a.age ?? 99) <= 30 && ((a.age ?? 99) < 15 || a.occupation === "student")),
    question: { en: "Studying in which class?", hi: "किस कक्षा में पढ़ रहे हैं?" },
    options: [
      { value: "class_1_8", icon: "🧒", label: VALUE_NAMES.class_1_8 },
      { value: "class_9_10", icon: "📘", label: VALUE_NAMES.class_9_10 },
      { value: "class_11_12", icon: "📗", label: VALUE_NAMES.class_11_12 },
      { value: "diploma", icon: "🛠️", label: VALUE_NAMES.diploma },
      { value: "ug", icon: "🎓", label: VALUE_NAMES.ug },
      { value: "pg", icon: "📜", label: VALUE_NAMES.pg },
      { value: "none", icon: "🚫", label: { en: "Not studying", hi: "नहीं पढ़ रहे" } },
    ],
  },
  {
    id: "isDisabled", kind: "choice", icon: "♿", voiceField: "isDisabled", when: inMode(PERSON_MODES),
    question: { en: "Any disability?", hi: "कोई दिव्यांगता है?" },
    options: yesNo("♿", "🚶"),
  },
  {
    id: "disabilityPercent", kind: "choice", icon: "📋", when: both(inMode(PERSON_MODES), (a) => a.isDisabled === true), optional: true,
    question: { en: "Disability % on the certificate?", hi: "प्रमाण पत्र पर दिव्यांगता कितने % है?" },
    options: [
      { value: 30, icon: "🟢", label: { en: "Below 40%", hi: "40% से कम" } },
      { value: 50, icon: "🟡", label: { en: "40–79%", hi: "40–79%" } },
      { value: 80, icon: "🔴", label: { en: "80% or more", hi: "80% या अधिक" } },
      { value: 0, icon: "❓", label: { en: "No certificate yet", hi: "प्रमाण पत्र नहीं है" } },
    ],
  },
  {
    id: "isPregnantOrLactating", kind: "choice", icon: "🤰", voiceField: "isPregnantOrLactating",
    when: both(inMode(PERSON_MODES), (a) => a.gender === "female" && (a.age ?? 0) >= 18 && (a.age ?? 0) <= 45),
    question: { en: "Pregnant, or feeding a small baby?", hi: "गर्भवती हैं या छोटे बच्चे को दूध पिलाती हैं?" },
    options: yesNo("🤰", "❌"),
  },
  {
    id: "hasBankAccount", kind: "choice", icon: "🏦", voiceField: "hasBankAccount",
    when: both(inMode(PERSON_MODES), (a) => (a.age ?? 18) >= 10),
    question: { en: "Has a bank account?", hi: "बैंक खाता है?" },
    options: yesNo("🏦", "❌"),
  },
  {
    id: "wantsToStartBusiness", kind: "choice", icon: "🏪", voiceField: "wantsToStartBusiness",
    when: both(inMode(PERSON_MODES), isAdult, (a) => ["self_employed", "unemployed", "artisan", "street_vendor", "homemaker", "other"].includes(a.occupation ?? "")),
    question: { en: "Want to start or grow a small business?", hi: "कोई छोटा काम-धंधा शुरू करना या बढ़ाना चाहते हैं?" },
    options: yesNo("🚀", "❌"),
  },
  {
    id: "isEpfoMember", kind: "choice", icon: "🧾", voiceField: "isEpfoMember",
    when: both(inMode(PERSON_MODES), (a) => a.occupation === "salaried_private"),
    question: { en: "Is PF / ESIC cut from the salary?", hi: "क्या तनख्वाह से PF / ESIC कटता है?" },
    options: yesNo(),
  },

  // ---- About the home: asked once per family ----
  {
    id: "area", kind: "choice", icon: "📍", voiceField: "area", when: inMode(HOUSEHOLD_MODES),
    question: { en: "Village or city?", hi: "गाँव में रहते हैं या शहर में?" },
    options: [opt("rural", "🏡"), opt("urban", "🏙️")],
  },
  {
    id: "district", kind: "choice", icon: "🗺️", when: inMode(HOUSEHOLD_MODES), optional: true,
    question: { en: "Which district of Madhya Pradesh?", hi: "मध्यप्रदेश का कौन सा ज़िला?" },
    options: MP_DISTRICTS.map((d) => ({ value: d.en, icon: "📍", label: d })),
  },
  {
    id: "income", kind: "choice", icon: "💰", voiceField: "annualIncome", when: inMode(HOUSEHOLD_MODES),
    question: { en: "Whole family's earning in a month?", hi: "पूरे परिवार की महीने की कमाई?" },
    options: [
      { value: 5000, icon: "🪙", label: { en: "Under ₹5,000", hi: "₹5,000 से कम" } },
      { value: 10000, icon: "💵", label: { en: "₹5,000–10,000", hi: "₹5,000–10,000" } },
      { value: 15000, icon: "💵", label: { en: "₹10,000–15,000", hi: "₹10,000–15,000" } },
      { value: 25000, icon: "💰", label: { en: "₹15,000–25,000", hi: "₹15,000–25,000" } },
      { value: 50000, icon: "💰", label: { en: "₹25,000–50,000", hi: "₹25,000–50,000" } },
      { value: 100000, icon: "🏦", label: { en: "More than ₹50,000", hi: "₹50,000 से ज़्यादा" } },
    ],
  },
  {
    id: "category", kind: "choice", icon: "📜", voiceField: "category", when: inMode(HOUSEHOLD_MODES), optional: true,
    question: { en: "Which category?", hi: "कौन सा वर्ग?" },
    hint: { en: "As written on the caste certificate", hi: "जाति प्रमाण पत्र के अनुसार" },
    options: [opt("general", "🔵"), opt("obc", "🟢"), opt("sc", "🟠"), opt("st", "🟣"), opt("ews", "🟡")],
  },
  {
    id: "isMinority", kind: "choice", icon: "🕌", voiceField: "isMinority", when: inMode(HOUSEHOLD_MODES), optional: true,
    question: { en: "Muslim, Christian, Sikh, Buddhist, Jain or Parsi?", hi: "मुस्लिम, ईसाई, सिख, बौद्ध, जैन या पारसी?" },
    options: yesNo("✅", "❌"),
  },
  {
    id: "isPVTG", kind: "choice", icon: "🌳", voiceField: "isPVTG", when: both(inMode(HOUSEHOLD_MODES), (a) => a.category === "st"), optional: true,
    question: { en: "Are you from the Baiga, Bharia or Saharia tribe?", hi: "क्या आप बैगा, भारिया या सहरिया जनजाति से हैं?" },
    options: yesNo("✅", "❌"),
  },
  {
    id: "ration", kind: "choice", icon: "🍚", voiceField: "isBPL", when: inMode(HOUSEHOLD_MODES),
    question: { en: "Which ration card do you have?", hi: "कौन सा राशन कार्ड है?" },
    options: [
      { value: "priority", icon: "🟨", label: { en: "BPL / Antyodaya / Priority (free ration)", hi: "BPL / अंत्योदय / प्राथमिकता (मुफ़्त राशन)" } },
      { value: "general", icon: "⬜", label: { en: "General (APL) card", hi: "सामान्य (APL) कार्ड" } },
      { value: "none", icon: "❌", label: { en: "No ration card", hi: "राशन कार्ड नहीं है" } },
    ],
  },
  {
    id: "house", kind: "choice", icon: "🏠", voiceField: "ownsPuccaHouse", when: inMode(HOUSEHOLD_MODES),
    question: { en: "What kind of house?", hi: "घर कैसा है?" },
    options: [
      { value: "pucca", icon: "🏠", label: { en: "Own pucca house", hi: "अपना पक्का घर" } },
      { value: "kutcha", icon: "🛖", label: { en: "Kutcha house", hi: "कच्चा घर" } },
      { value: "rented", icon: "🔑", label: { en: "Rented", hi: "किराये का" } },
      { value: "none", icon: "⛺", label: { en: "No house", hi: "घर नहीं है" } },
    ],
  },
  {
    id: "hasLpgConnection", kind: "choice", icon: "🔥", voiceField: "hasLpgConnection", when: inMode(HOUSEHOLD_MODES),
    question: { en: "LPG gas connection at home?", hi: "घर में गैस कनेक्शन है?" },
    options: yesNo("🔥", "🪵"),
  },
  {
    id: "hasToilet", kind: "choice", icon: "🚻", voiceField: "hasToilet", when: both(inMode(HOUSEHOLD_MODES), (a) => a.area === "rural"),
    question: { en: "Toilet at home?", hi: "घर में शौचालय है?" },
    options: yesNo("🚻", "❌"),
  },
  {
    id: "landHectares", kind: "choice", icon: "🌾", voiceField: "landHectares",
    when: (a, m) => m === "household" || (m === "new" && a.occupation === "farmer"),
    question: { en: "How much farm land does the family own?", hi: "परिवार के नाम कितनी खेती की ज़मीन है?" },
    options: [
      { value: 0, icon: "🚫", label: { en: "None", hi: "कोई नहीं" } },
      { value: 0.8, icon: "🌱", label: { en: "Up to 2 acres", hi: "2 एकड़ तक" } },
      { value: 2, icon: "🌾", label: { en: "2–5 acres", hi: "2–5 एकड़" } },
      { value: 4, icon: "🚜", label: { en: "More than 5 acres", hi: "5 एकड़ से ज़्यादा" } },
    ],
  },
  {
    id: "breadwinnerDiedRecently", kind: "choice", icon: "🕯️", voiceField: "breadwinnerDiedRecently",
    when: (a, m) => m === "household" || (m === "new" && a.maritalStatus === "widowed"),
    question: { en: "Did the family's main earner pass away in the last year?", hi: "क्या पिछले एक साल में परिवार के मुख्य कमाने वाले का निधन हुआ?" },
    options: yesNo("🕯️", "❌"),
  },

  // ---- Account ----
  {
    id: "mobile", kind: "mobile", icon: "📱", when: inMode(ACCOUNT_MODES),
    question: { en: "Your mobile number", hi: "आपका मोबाइल नंबर" },
    hint: { en: "You'll log in with this", hi: "इससे आप लॉगिन करेंगे" },
  },
  {
    id: "pin", kind: "pin", icon: "🔒", when: inMode(ACCOUNT_MODES),
    question: { en: "Choose a 4-digit PIN", hi: "4 अंकों का PIN चुनें" },
    hint: { en: "Easy for you to remember, hard for others to guess", hi: "जो आपको याद रहे, दूसरों को पता न हो" },
  },
  {
    id: "consent", kind: "consent", icon: "🤝", when: inMode(ACCOUNT_MODES),
    question: { en: "May we save these details to find schemes for your family?", hi: "क्या हम आपके परिवार के लिए योजनाएँ ढूँढने के लिए यह जानकारी सुरक्षित रखें?" },
    hint: {
      en: "Only used to find schemes. Never shared. You can delete everything any time. We never ask for Aadhaar or bank numbers.",
      hi: "केवल योजनाएँ ढूँढने के लिए। किसी को नहीं दी जाएगी। आप कभी भी सब मिटा सकते हैं। हम कभी आधार या बैंक नंबर नहीं माँगते।",
    },
  },
];

export const visibleSteps = (a: Answers, mode: WizardMode) => STEPS.filter((s) => !s.when || s.when(a, mode));

/** Wizard answers → a flat profile the API understands. */
export function answersToProfile(a: Answers): Profile {
  const { relation: _r, code: _c, mobile: _m, pin: _p, consent: _k, study, ration, house, income, ...rest } = a;
  void _r; void _c; void _m; void _p; void _k;
  const p: Profile = { ...rest };
  if (study !== undefined) {
    p.isStudent = study !== "none";
    if (study !== "none") p.studyLevel = study as Profile["studyLevel"];
  }
  if ((a.age ?? 99) < 15 && !p.occupation) p.occupation = study && study !== "none" ? "student" : "other";
  if (ration) p.isBPL = ration === "priority";
  if (house) p.ownsPuccaHouse = house === "pucca";
  if (income !== undefined) p.annualIncome = income * 12;
  // NagrikAI currently serves Madhya Pradesh; any household answer implies the state.
  if (p.area !== undefined || p.district !== undefined) p.state = "Madhya Pradesh";
  return p;
}

/** A stored profile → wizard answers (for editing). */
export function profileToAnswers(p: Profile): Answers {
  const a: Answers = { ...p };
  if (p.isStudent !== undefined) a.study = p.isStudent ? (p.studyLevel ?? "class_1_8") : "none";
  if (p.isBPL !== undefined) a.ration = p.isBPL ? "priority" : "general";
  if (p.ownsPuccaHouse !== undefined) a.house = p.ownsPuccaHouse ? "pucca" : "kutcha";
  if (p.annualIncome !== undefined) {
    const monthly = p.annualIncome / 12;
    a.income = [5000, 10000, 15000, 25000, 50000, 100000].find((v) => monthly <= v) ?? 100000;
  }
  return a;
}
