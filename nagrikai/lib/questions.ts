import { VALUE_NAMES } from "./labels";
import type { AskFor, ProfileField, Text } from "./types";

const YES_NO = [
  { value: true, label: { en: "Yes", hi: "हाँ" } },
  { value: false, label: { en: "No", hi: "नहीं" } },
];
const enumOpts = (vals: string[]) => vals.map((v) => ({ value: v, label: VALUE_NAMES[v] }));

type Q = { question: Text; options: AskFor["options"] };

/** Follow-up questions, in simple spoken language. Options become quick-reply chips. */
export const QUESTIONS: Partial<Record<ProfileField, Q>> = {
  age: { question: { en: "How old are you?", hi: "आपकी उम्र कितनी है?" }, options: [] },
  gender: { question: { en: "Are you a man or a woman?", hi: "आप पुरुष हैं या महिला?" }, options: enumOpts(["female", "male", "transgender"]) },
  area: { question: { en: "Do you live in a village or a town/city?", hi: "आप गाँव में रहते हैं या शहर में?" }, options: enumOpts(["rural", "urban"]) },
  annualIncome: {
    question: { en: "Roughly how much does your whole family earn in a month?", hi: "आपके पूरे परिवार की महीने की कमाई लगभग कितनी है?" },
    options: [
      { value: 60000, label: { en: "Under ₹5,000", hi: "₹5,000 से कम" } },
      { value: 120000, label: { en: "₹5,000–₹10,000", hi: "₹5,000–₹10,000" } },
      { value: 180000, label: { en: "₹10,000–₹15,000", hi: "₹10,000–₹15,000" } },
      { value: 300000, label: { en: "₹15,000–₹25,000", hi: "₹15,000–₹25,000" } },
      { value: 600000, label: { en: "₹25,000–₹50,000", hi: "₹25,000–₹50,000" } },
      { value: 1000000, label: { en: "More than ₹50,000", hi: "₹50,000 से ज़्यादा" } },
    ],
  },
  category: { question: { en: "Which category do you belong to?", hi: "आप किस वर्ग से हैं?" }, options: enumOpts(["general", "obc", "sc", "st", "ews"]) },
  isMinority: { question: { en: "Are you from a minority community (Muslim, Christian, Sikh, Buddhist, Jain, Parsi)?", hi: "क्या आप अल्पसंख्यक समुदाय (मुस्लिम, ईसाई, सिख, बौद्ध, जैन, पारसी) से हैं?" }, options: YES_NO },
  isPVTG: { question: { en: "Are you from the Baiga, Bharia or Saharia tribe?", hi: "क्या आप बैगा, भारिया या सहरिया जनजाति से हैं?" }, options: YES_NO },
  maritalStatus: { question: { en: "What is your marital status?", hi: "आपकी वैवाहिक स्थिति क्या है?" }, options: enumOpts(["married", "single", "widowed", "divorced"]) },
  occupation: {
    question: { en: "What work do you do?", hi: "आप क्या काम करते हैं?" },
    options: enumOpts(["farmer", "agri_labourer", "construction_worker", "domestic_worker", "street_vendor", "artisan", "self_employed", "student", "homemaker", "unemployed", "salaried_private", "govt_employee"]),
  },
  isBPL: { question: { en: "Do you have a BPL / Antyodaya / priority-household ration card?", hi: "क्या आपके पास BPL / अंत्योदय / प्राथमिकता परिवार राशन कार्ड है?" }, options: YES_NO },
  isDisabled: { question: { en: "Does anyone applying have a disability?", hi: "क्या आवेदक को कोई दिव्यांगता है?" }, options: YES_NO },
  disabilityPercent: {
    question: { en: "What disability % is written on the certificate?", hi: "प्रमाण पत्र पर दिव्यांगता कितने % लिखी है?" },
    options: [
      { value: 30, label: { en: "Below 40%", hi: "40% से कम" } },
      { value: 50, label: { en: "40–79%", hi: "40–79%" } },
      { value: 80, label: { en: "80% or more", hi: "80% या अधिक" } },
    ],
  },
  landHectares: {
    question: { en: "How much farm land do you own?", hi: "आपके नाम पर कितनी खेती की ज़मीन है?" },
    options: [
      { value: 0, label: { en: "None", hi: "कोई नहीं" } },
      { value: 0.8, label: { en: "Up to 2 acres", hi: "2 एकड़ तक" } },
      { value: 2, label: { en: "2–5 acres", hi: "2–5 एकड़" } },
      { value: 4, label: { en: "More than 5 acres", hi: "5 एकड़ से ज़्यादा" } },
    ],
  },
  ownsPuccaHouse: { question: { en: "Do you own a pucca (brick/cement) house?", hi: "क्या आपका अपना पक्का मकान है?" }, options: YES_NO },
  hasLpgConnection: { question: { en: "Do you have an LPG gas connection at home?", hi: "क्या आपके घर में LPG गैस कनेक्शन है?" }, options: YES_NO },
  hasToilet: { question: { en: "Do you have a toilet at home?", hi: "क्या आपके घर में शौचालय है?" }, options: YES_NO },
  hasBankAccount: { question: { en: "Do you have a bank account?", hi: "क्या आपका बैंक खाता है?" }, options: YES_NO },
  isIncomeTaxPayer: { question: { en: "Do you pay income tax?", hi: "क्या आप आयकर (इनकम टैक्स) भरते हैं?" }, options: YES_NO },
  isGovtEmployee: { question: { en: "Are you (or anyone in your family) a regular government employee?", hi: "क्या आप (या परिवार में कोई) नियमित सरकारी कर्मचारी है?" }, options: YES_NO },
  isEpfoMember: { question: { en: "Is PF (EPFO) or ESIC deducted from your salary?", hi: "क्या आपकी तनख्वाह से PF (EPFO) या ESIC कटता है?" }, options: YES_NO },
  isPregnantOrLactating: { question: { en: "Are you pregnant or breastfeeding a baby?", hi: "क्या आप गर्भवती हैं या बच्चे को दूध पिलाती हैं?" }, options: YES_NO },
  hasChildUnder6: { question: { en: "Do you have a child under 6 years?", hi: "क्या आपका कोई बच्चा 6 साल से छोटा है?" }, options: YES_NO },
  hasSchoolChildren: { question: { en: "Do you have children aged 6–14 going to school?", hi: "क्या आपके 6–14 साल के बच्चे स्कूल जाते हैं?" }, options: YES_NO },
  hasGirlChildUnder10: { question: { en: "Do you have a daughter under 10?", hi: "क्या आपकी 10 साल से छोटी बेटी है?" }, options: YES_NO },
  isStudent: { question: { en: "Are you currently studying?", hi: "क्या आप अभी पढ़ाई कर रहे हैं?" }, options: YES_NO },
  studyLevel: { question: { en: "What are you studying now?", hi: "आप अभी क्या पढ़ रहे हैं?" }, options: enumOpts(["class_1_8", "class_9_10", "class_11_12", "diploma", "ug", "pg"]) },
  wantsToStartBusiness: { question: { en: "Do you want to start or grow a small business?", hi: "क्या आप कोई छोटा व्यवसाय शुरू करना या बढ़ाना चाहते हैं?" }, options: YES_NO },
  breadwinnerDiedRecently: { question: { en: "Did the main earning member of your family pass away in the last year?", hi: "क्या पिछले एक साल में आपके परिवार के मुख्य कमाने वाले सदस्य का निधन हुआ है?" }, options: YES_NO },
};
