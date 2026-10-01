import type { Lang, Leaf, ProfileField, Text } from "./types";

/** Human names for profile fields. */
export const FIELD_NAMES: Record<ProfileField, Text> = {
  name: { en: "Name", hi: "नाम" },
  age: { en: "Age", hi: "आयु" },
  gender: { en: "Gender", hi: "लिंग" },
  state: { en: "State", hi: "राज्य" },
  district: { en: "District", hi: "ज़िला" },
  area: { en: "Area", hi: "क्षेत्र" },
  annualIncome: { en: "Annual household income", hi: "वार्षिक पारिवारिक आय" },
  category: { en: "Social category", hi: "सामाजिक वर्ग" },
  isMinority: { en: "Minority community", hi: "अल्पसंख्यक समुदाय" },
  isPVTG: { en: "Baiga / Bharia / Saharia tribe", hi: "बैगा / भारिया / सहरिया जनजाति" },
  maritalStatus: { en: "Marital status", hi: "वैवाहिक स्थिति" },
  occupation: { en: "Occupation", hi: "व्यवसाय" },
  isBPL: { en: "BPL / priority ration card", hi: "BPL / प्राथमिकता राशन कार्ड" },
  isDisabled: { en: "Person with disability", hi: "दिव्यांग व्यक्ति" },
  disabilityPercent: { en: "Disability %", hi: "दिव्यांगता %" },
  landHectares: { en: "Land (hectares)", hi: "ज़मीन (हेक्टेयर)" },
  ownsPuccaHouse: { en: "Owns a pucca house", hi: "अपना पक्का मकान" },
  hasLpgConnection: { en: "Has LPG connection", hi: "LPG कनेक्शन है" },
  hasToilet: { en: "Has toilet at home", hi: "घर में शौचालय है" },
  hasBankAccount: { en: "Has bank account", hi: "बैंक खाता है" },
  isIncomeTaxPayer: { en: "Income-tax payer", hi: "आयकर दाता" },
  isGovtEmployee: { en: "Government employee", hi: "सरकारी कर्मचारी" },
  isEpfoMember: { en: "EPFO / ESIC / NPS member", hi: "EPFO / ESIC / NPS सदस्य" },
  isPregnantOrLactating: { en: "Pregnant or breastfeeding", hi: "गर्भवती या स्तनपान कराने वाली" },
  hasChildUnder6: { en: "Child under 6", hi: "6 वर्ष से कम उम्र का बच्चा" },
  hasSchoolChildren: { en: "Child aged 6–14 in school", hi: "स्कूल जाने वाला 6–14 वर्ष का बच्चा" },
  hasGirlChildUnder10: { en: "Daughter under 10", hi: "10 वर्ष से कम उम्र की बेटी" },
  isStudent: { en: "Student", hi: "छात्र" },
  studyLevel: { en: "Study level", hi: "पढ़ाई का स्तर" },
  wantsToStartBusiness: { en: "Wants to start / grow a business", hi: "व्यवसाय शुरू / बढ़ाना चाहते हैं" },
  breadwinnerDiedRecently: { en: "Family breadwinner died recently", hi: "परिवार के कमाने वाले सदस्य की हाल में मृत्यु" },
};

/** Display names for enum values. */
export const VALUE_NAMES: Record<string, Text> = {
  male: { en: "Male", hi: "पुरुष" },
  female: { en: "Female", hi: "महिला" },
  transgender: { en: "Transgender", hi: "ट्रांसजेंडर" },
  rural: { en: "Rural", hi: "ग्रामीण" },
  urban: { en: "Urban", hi: "शहरी" },
  general: { en: "General", hi: "सामान्य" },
  obc: { en: "OBC", hi: "OBC" },
  sc: { en: "SC", hi: "अनुसूचित जाति (SC)" },
  st: { en: "ST", hi: "अनुसूचित जनजाति (ST)" },
  ews: { en: "EWS", hi: "EWS" },
  single: { en: "Single", hi: "अविवाहित" },
  married: { en: "Married", hi: "विवाहित" },
  widowed: { en: "Widowed", hi: "विधवा / विधुर" },
  divorced: { en: "Divorced / separated", hi: "तलाकशुदा / अलग" },
  farmer: { en: "Farmer", hi: "किसान" },
  agri_labourer: { en: "Farm labourer", hi: "खेतिहर मज़दूर" },
  construction_worker: { en: "Construction worker", hi: "निर्माण मज़दूर" },
  domestic_worker: { en: "Domestic worker", hi: "घरेलू कामगार" },
  street_vendor: { en: "Street vendor", hi: "रेहड़ी-पटरी विक्रेता" },
  artisan: { en: "Artisan / craftsperson", hi: "कारीगर / शिल्पकार" },
  fisherman: { en: "Fisher", hi: "मछुआरा" },
  student: { en: "Student", hi: "छात्र" },
  unemployed: { en: "Unemployed", hi: "बेरोज़गार" },
  salaried_private: { en: "Private salaried job", hi: "निजी नौकरी" },
  govt_employee: { en: "Government employee", hi: "सरकारी कर्मचारी" },
  self_employed: { en: "Self-employed / small business", hi: "स्वरोज़गार / छोटा व्यवसाय" },
  homemaker: { en: "Homemaker", hi: "गृहिणी" },
  retired: { en: "Retired", hi: "सेवानिवृत्त" },
  other: { en: "Other", hi: "अन्य" },
  class_1_8: { en: "Class 1–8", hi: "कक्षा 1–8" },
  class_9_10: { en: "Class 9–10", hi: "कक्षा 9–10" },
  class_11_12: { en: "Class 11–12", hi: "कक्षा 11–12" },
  diploma: { en: "Diploma / ITI", hi: "डिप्लोमा / ITI" },
  ug: { en: "Graduation", hi: "स्नातक" },
  pg: { en: "Post-graduation", hi: "स्नातकोत्तर" },
};

const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

function fmtValue(field: ProfileField, v: unknown, lang: Lang): string {
  if (Array.isArray(v)) return v.map((x) => fmtValue(field, x, lang)).join(lang === "hi" ? " / " : " / ");
  if (typeof v === "string") return VALUE_NAMES[v]?.[lang] ?? v;
  if (typeof v === "number") {
    if (field === "annualIncome") return rupees(v);
    if (field === "disabilityPercent") return v + "%";
    return String(v);
  }
  return String(v);
}

/** Generate a readable label for a leaf condition when the scheme didn't supply one. */
export function leafLabel(leaf: Leaf): Text {
  if (leaf.label) return leaf.label;
  const f = leaf.field;
  const make = (lang: Lang): string => {
    const name = FIELD_NAMES[f][lang];
    const v = leaf.value;
    const hi = lang === "hi";
    switch (leaf.op) {
      case "true":
        return name;
      case "false":
        return hi ? `${name} — नहीं` : `Not: ${name.toLowerCase()}`;
      case "eq":
        return `${name}: ${fmtValue(f, v, lang)}`;
      case "neq":
        return hi ? `${name}: ${fmtValue(f, v, lang)} नहीं` : `${name} is not ${fmtValue(f, v, lang)}`;
      case "in":
        return `${name}: ${fmtValue(f, v, lang)}`;
      case "nin":
        return hi ? `${name}: ${fmtValue(f, v, lang)} नहीं` : `${name} is not ${fmtValue(f, v, lang)}`;
      case "gte":
        if (f === "age") return hi ? `आयु ${v} वर्ष या अधिक` : `Age ${v} or above`;
        return hi ? `${name} ${fmtValue(f, v, lang)} या अधिक` : `${name} at least ${fmtValue(f, v, lang)}`;
      case "gt":
        return hi ? `${name} ${fmtValue(f, v, lang)} से अधिक` : `${name} more than ${fmtValue(f, v, lang)}`;
      case "lte":
        return hi ? `${name} ${fmtValue(f, v, lang)} या कम` : `${name} up to ${fmtValue(f, v, lang)}`;
      case "lt":
        return hi ? `${name} ${fmtValue(f, v, lang)} से कम` : `${name} below ${fmtValue(f, v, lang)}`;
      case "between": {
        const [a, b] = v as [number, number];
        if (f === "age") return hi ? `आयु ${a}–${b} वर्ष` : `Age ${a}–${b} years`;
        return `${name}: ${fmtValue(f, a, lang)}–${fmtValue(f, b, lang)}`;
      }
    }
  };
  return { en: make("en"), hi: make("hi") };
}

export function formatProfileValue(field: ProfileField, v: unknown, lang: Lang): string {
  if (typeof v === "boolean") return v ? (lang === "hi" ? "हाँ" : "Yes") : lang === "hi" ? "नहीं" : "No";
  return fmtValue(field, v, lang);
}

export { rupees };

/** Human-readable list of a scheme's eligibility conditions ("any" groups joined with "or"). */
export function criteriaLabels(rule: import("./types").Rule, lang: Lang): string[] {
  if ("field" in rule) return [leafLabel(rule)[lang]];
  if ("all" in rule) return rule.all.flatMap((r) => criteriaLabels(r, lang));
  const parts = rule.any.map((r) => criteriaLabels(r, lang).join(lang === "hi" ? " और " : " and "));
  return [(lang === "hi" ? "इनमें से कोई एक: " : "Any one of: ") + parts.join(lang === "hi" ? " / या " : " / or ")];
}
