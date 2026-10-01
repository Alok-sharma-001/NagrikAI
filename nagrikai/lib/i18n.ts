import type { Category, Lang } from "./types";

const STRINGS = {
  tagline: { en: "Know your benefits. Understand your eligibility. Never miss an opportunity.", hi: "अपने लाभ जानें। अपनी पात्रता समझें। कोई मौका न छोड़ें।" },
  askPlaceholder: { en: "Tell me about yourself…", hi: "अपने बारे में बताइए…" },
  send: { en: "Send", hi: "भेजें" },
  listening: { en: "Listening… speak now", hi: "सुन रहा हूँ… बोलिए" },
  tapToSpeak: { en: "Tap to speak", hi: "बोलने के लिए दबाएँ" },
  voiceUnsupported: { en: "Voice input isn't available here. Please type instead.", hi: "यहाँ आवाज़ से जवाब देना उपलब्ध नहीं है। कृपया टाइप करें।" },
  greeting: {
    en: "Namaste! I'm NagrikAI. Tell me about yourself — your age, what work you do, where you live, and your family's income — and I'll find government schemes you can get.",
    hi: "नमस्ते! मैं नागरिक AI हूँ। अपने बारे में बताइए — आपकी उम्र, आप क्या काम करते हैं, कहाँ रहते हैं, और परिवार की कमाई — मैं आपके लिए सरकारी योजनाएँ ढूँढूँगा।",
  },
  example: { en: "Try an example", hi: "उदाहरण आज़माएँ" },
  yourProfile: { en: "What I know about you", hi: "आपके बारे में जानकारी" },
  editProfile: { en: "Edit / fill form", hi: "बदलें / फ़ॉर्म भरें" },
  closeForm: { en: "Done", hi: "हो गया" },
  clearData: { en: "Clear my data", hi: "मेरा डेटा मिटाएँ" },
  eligible: { en: "You qualify", hi: "आप पात्र हैं" },
  possible: { en: "Might qualify", hi: "पात्र हो सकते हैं" },
  checklist: { en: "Documents", hi: "दस्तावेज़" },
  reminders: { en: "Reminders", hi: "रिमाइंडर" },
  schemesFor: { en: "schemes you qualify for", hi: "योजनाएँ जिनके लिए आप पात्र हैं" },
  perYear: { en: "per year", hi: "प्रति वर्ष" },
  oneTime: { en: "one-time", hi: "एकमुश्त" },
  cover: { en: "insurance / health cover", hi: "बीमा / स्वास्थ्य कवर" },
  why: { en: "Why?", hi: "क्यों?" },
  listen: { en: "Listen", hi: "सुनें" },
  stop: { en: "Stop", hi: "रोकें" },
  apply: { en: "How to apply", hi: "आवेदन कैसे करें" },
  officialSite: { en: "Official website", hi: "आधिकारिक वेबसाइट" },
  source: { en: "Source", hi: "स्रोत" },
  helpline: { en: "Helpline", hi: "हेल्पलाइन" },
  noHelpline: { en: "Visit your nearest CSC / Gram Panchayat / municipal office", hi: "नज़दीकी CSC / ग्राम पंचायत / नगर निगम कार्यालय जाएँ" },
  docsNeeded: { en: "Documents needed", hi: "ज़रूरी दस्तावेज़" },
  alsoRequired: { en: "Also checked by the office", hi: "कार्यालय यह भी जाँचेगा" },
  stateNote: { en: "In your state", hi: "आपके राज्य में" },
  whyQualify: { en: "Why you qualify", hi: "आप क्यों पात्र हैं" },
  needToKnow: { en: "Answer to check", hi: "जाँचने के लिए बताएँ" },
  notEligibleBecause: { en: "Not eligible because", hi: "पात्र नहीं क्योंकि" },
  neededFor: { en: "Needed for", hi: "इनके लिए ज़रूरी" },
  whereToGet: { en: "Where to get it", hi: "कहाँ से बनवाएँ" },
  addToCalendar: { en: "Add all to calendar", hi: "सभी कैलेंडर में जोड़ें" },
  noDate: { en: "No fixed deadline", hi: "कोई तय अंतिम तिथि नहीं" },
  emptyResults: { en: "Tell me about yourself to see schemes you can get.", hi: "अपनी योजनाएँ देखने के लिए अपने बारे में बताइए।" },
  notEligibleList: { en: "Checked but not eligible", hi: "जाँचा गया, पर पात्र नहीं" },
  disclaimer: {
    en: "NagrikAI gives guidance based on official scheme rules — final eligibility is decided by the government office. Never pay anyone to apply; most schemes are free.",
    hi: "नागरिक AI आधिकारिक योजना नियमों के आधार पर मार्गदर्शन देता है — अंतिम पात्रता सरकारी कार्यालय तय करता है। आवेदन के लिए किसी को पैसे न दें; अधिकांश योजनाएँ मुफ़्त हैं।",
  },
  privacy: { en: "Your details stay on this device. We never ask for Aadhaar or bank numbers.", hi: "आपकी जानकारी इसी फ़ोन पर रहती है। हम कभी आधार या बैंक नंबर नहीं माँगते।" },
  thinking: { en: "Checking schemes…", hi: "योजनाएँ जाँच रहा हूँ…" },
  modeRules: { en: "Offline rules mode", hi: "ऑफ़लाइन नियम मोड" },
  modeLLM: { en: "AI mode", hi: "AI मोड" },
  print: { en: "Print / Save PDF", hi: "प्रिंट / PDF सेव करें" },
  explainError: { en: "Couldn't load the explanation. Please try again.", hi: "जानकारी लोड नहीं हो सकी। फिर से कोशिश करें।" },
  networkError: { en: "Network problem — please try again.", hi: "नेटवर्क समस्या — फिर से कोशिश करें।" },
  notSet: { en: "Not set", hi: "नहीं बताया" },
  yes: { en: "Yes", hi: "हाँ" },
  no: { en: "No", hi: "नहीं" },
} as const;

export type StringKey = keyof typeof STRINGS;
export const t = (key: StringKey, lang: Lang) => STRINGS[key][lang];

export const CATEGORY_NAMES: Record<Category, { en: string; hi: string; icon: string }> = {
  health: { en: "Health", hi: "स्वास्थ्य", icon: "🏥" },
  housing: { en: "Housing", hi: "आवास", icon: "🏠" },
  pension: { en: "Pension", hi: "पेंशन", icon: "👵" },
  education: { en: "Education", hi: "शिक्षा", icon: "🎓" },
  agriculture: { en: "Farming", hi: "खेती", icon: "🌾" },
  employment: { en: "Work", hi: "रोज़गार", icon: "🧰" },
  women_child: { en: "Women & child", hi: "महिला व बच्चे", icon: "👩‍👧" },
  financial_inclusion: { en: "Banking", hi: "बैंकिंग", icon: "🏦" },
  insurance: { en: "Insurance", hi: "बीमा", icon: "🛡️" },
  food: { en: "Food", hi: "राशन", icon: "🍚" },
  skill: { en: "Skills", hi: "कौशल", icon: "🛠️" },
  business: { en: "Business", hi: "व्यवसाय", icon: "🏪" },
  disability: { en: "Disability", hi: "दिव्यांगता", icon: "♿" },
  sanitation: { en: "Sanitation", hi: "स्वच्छता", icon: "🚻" },
  energy: { en: "Energy", hi: "ऊर्जा", icon: "🔥" },
};

export const EXAMPLES: { label: { en: string; hi: string }; text: { en: string; hi: string } }[] = [
  {
    label: { en: "Priya — widow, domestic worker", hi: "प्रिया — विधवा, घरेलू कामगार" },
    text: {
      hi: "मेरा नाम प्रिया है, मैं 35 साल की विधवा हूँ, दिल्ली में घरों में काम करती हूँ, महीने के दस हज़ार कमाती हूँ, मेरे दो बच्चे हैं जो स्कूल जाते हैं, मेरे पास बीपीएल राशन कार्ड है।",
      en: "My name is Priya, I am a 35 year old widow, I work as a domestic worker in Delhi, I earn 10 thousand a month, I have two children who go to school and I have a BPL ration card.",
    },
  },
  {
    label: { en: "Ramesh — small farmer", hi: "रमेश — छोटे किसान" },
    text: {
      hi: "मैं रमेश हूँ, 52 साल का किसान, मध्य प्रदेश के गाँव में रहता हूँ, डेढ़ एकड़ ज़मीन है, बीपीएल कार्ड है, कच्चा घर है और गैस कनेक्शन नहीं है।",
      en: "I am Ramesh, a 52 year old farmer living in a village in Madhya Pradesh. I have 1.5 acres of land, a BPL card, a kutcha house and no gas connection.",
    },
  },
  {
    label: { en: "Ananya — SC college student", hi: "अनन्या — SC कॉलेज छात्रा" },
    text: {
      hi: "मैं अनन्या हूँ, 19 साल की छात्रा हूँ, अनुसूचित जाति से हूँ, कॉलेज में बी.टेक पढ़ती हूँ, परिवार की सालाना आय 1.8 लाख है।",
      en: "I'm Ananya, a 19 year old SC student studying B.Tech in college. My family's annual income is 1.8 lakh.",
    },
  },
];
