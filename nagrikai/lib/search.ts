import { SCHEMES } from "./kb";
import type { Category, Scheme } from "./types";

/** Everyday words people use → scheme categories / ids. */
const SYNONYMS: [RegExp, { category?: Category; ids?: string[] }][] = [
  [/(इलाज|अस्पताल|बीमारी|दवा|ऑपरेशन|आयुष्मान|hospital|treatment|health|medical|ayushman|ilaj|ilaaj|dawa|bimari|aspatal)/i, { category: "health" }],
  [/(घर|मकान|आवास|छत|house|home|housing|awas|ghar|makan|makaan|aawas)/i, { category: "housing" }],
  [/(पेंशन|बुढ़ापा|बुजुर्ग|वृद्ध|विधवा|pension|old age|widow|vidhwa|vidhva|budhapa)/i, { category: "pension" }],
  [/(छात्रवृत्ति|वजीफ़ा|वजीफा|पढ़ाई|स्कूल|कॉलेज|scholarship|school|college|study|education|padhai|padhayi|chhatravritti|vajifa)/i, { category: "education" }],
  [/(किसान|खेती|फसल|खेत|kisan|farmer|crop|farming|agri|kheti|fasal)/i, { category: "agriculture" }],
  [/(राशन|अनाज|गेहूं|चावल|ration|rashan|food|grain|anaj)/i, { category: "food" }],
  [/(गैस|सिलेंडर|lpg|ujjwala|ujjawala|\bgas\b|cylinder|उज्ज्वला|चूल्हा)/i, { ids: ["pmuy"] }],
  [/(बिजली|सोलर|solar|electricity|bijli)/i, { ids: ["pm-surya-ghar", "pm-kusum"] }],
  [/(शौचालय|toilet|shauchalay|sauchalay)/i, { ids: ["sbm-g-ihhl"] }],
  [/(बीमा|insurance|bima|beema)/i, { category: "insurance" }],
  [/(लोन|ऋण|कर्ज़|कर्ज|व्यापार|दुकान|धंधा|loan|business|shop|mudra|dukan|dukaan|vyapar|karz|karj|dhandha|मुद्रा)/i, { category: "business" }],
  [/(नौकरी|बेरोज़गार|बेरोजगार|job|unemployed|internship|naukri|berojgar|berozgar|इंटर्नशिप)/i, { ids: ["mp-seekho-kamao", "pm-internship", "pmkvy"] }],
  [/(नौकरी|रोज़गार|रोजगार|काम|मजदूरी|मज़दूरी|job|work|employment|nrega|मनरेगा)/i, { category: "employment" }],
  [/(प्रशिक्षण|ट्रेनिंग|कौशल|सीखना|training|skill|course|prashikshan|kaushal)/i, { category: "skill" }],
  [/(गर्भ|प्रसव|डिलीवरी|बच्चा|बेटी|माँ|pregnan|delivery|baby|daughter|mother|garbhvati|prasav|beti)/i, { category: "women_child" }],
  [/(दिव्यांग|विकलांग|disab|handicap|divyang|viklang|व्हीलचेयर|wheelchair)/i, { category: "disability" }],
  [/(बैंक|खाता|bank|account|jan dhan|khata|जन धन)/i, { category: "financial_inclusion" }],
];

const STOP = new Set(
  "के की का को में से पर लिए है हैं और या भी कैसे क्या कब कौन मुझे मेरा मेरी मेरे हम आप इस उस एक लिये वाला वाली योजना scheme yojana the for and how what when my of to in is a an ka ki ke".split(" "),
);
const tokens = (s: string) =>
  s.toLowerCase().split(/[\s,.?!।:;()\-–/]+/).filter((t) => t.length > 1 && !STOP.has(t));

/** Rank schemes for a free-text question. Name matches beat category matches. */
export function searchSchemes(query: string, limit = 12): Scheme[] {
  const q = query.normalize("NFC").toLowerCase();
  const qt = new Set(tokens(q));
  const hints = SYNONYMS.filter(([re]) => re.test(q)).map(([, h]) => h);
  return SCHEMES.map((s) => {
    let score = 0;
    const nameTokens = tokens(`${s.name.en} ${s.name.hi} ${s.id}`);
    // "प्रधानमंत्री" / "योजना" appear in dozens of names — they must not match a scheme on their own.
    for (const t of nameTokens) if (qt.has(t) && t.length > 2 && !NAME_STOP.has(t)) score += 5;
    for (const t of tokens(`${s.summary.en} ${s.summary.hi}`)) if (qt.has(t) && t.length > 3) score += 1;
    for (const h of hints) {
      if (h.ids?.includes(s.id)) score += 8;
      if (h.category === s.category) score += 6;
    }
    return { s, score };
  })
    // One stray word shared with a scheme's description ("भारत") is not a match.
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

/** Words too common in scheme names to identify one ("योजना", "मुख्यमंत्री"…). */
const NAME_STOP = new Set(
  "मुख्यमंत्री प्रधानमंत्री राष्ट्रीय भारत पीएम कार्ड पेंशन सहायता pm mukhyamantri pradhan mantri national yojana scheme card pension india govt mp cm for and the of".split(" "),
);

/** Everyday words that appear in a scheme name but don't identify it ("बेटी" ≠ "गाँव की बेटी योजना"). */
const GENERIC = new Set(
  "बेटी बेटियों किसान कन्या विवाह आवास छात्र छात्रों विद्यार्थी शिक्षा कौशल महिला बीमा छात्रवृत्ति सुरक्षा कल्याण रोज़गार गाँव ग्रामीण शहरी मुफ़्त निःशुल्क सामाजिक जन beti kisan kanya vivah awas student students scholarship insurance kalyan free rural urban women gramin jan".split(" "),
);

/** Schemes the question mentions by name, best match first, with the name words that matched. */
export function mentionedSchemes(query: string): { scheme: Scheme; words: string[] }[] {
  const qt = new Set(tokens(query.normalize("NFC")).filter((t) => !NAME_STOP.has(t)));
  return SCHEMES.map((scheme) => {
    const names = new Set(tokens(`${scheme.name.en} ${scheme.name.hi}`).filter((t) => !NAME_STOP.has(t) && t.length > 2));
    return { scheme, words: [...names].filter((t) => qt.has(t)) };
  })
    // One generic word is not a mention; a distinctive word, or two words together, is.
    .filter((x) => x.words.length >= 2 || x.words.some((w) => !GENERIC.has(w)))
    .sort((a, b) => b.words.length - a.words.length);
}
