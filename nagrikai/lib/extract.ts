import type { Profile } from "./types";

/**
 * Rule-based Hindi/English profile extractor. Used when no LLM is configured
 * and as a safety net if the LLM call fails. Deliberately conservative: it only
 * sets a field when a clear cue is present.
 */

const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const toAsciiDigits = (s: string) => s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));

const NUM_WORDS: Record<string, number> = {
  डेढ़: 1.5, ढाई: 2.5, एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  ग्यारह: 11, बारह: 12, पंद्रह: 15, बीस: 20, पच्चीस: 25, तीस: 30, पैंतीस: 35, चालीस: 40, पैंतालीस: 45,
  पचास: 50, पचपन: 55, साठ: 60, पैंसठ: 65, सत्तर: 70, पचहत्तर: 75, अस्सी: 80, नब्बे: 90, सौ: 100,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fifteen: 15, twenty: 20, "twenty-five": 25, thirty: 30, "thirty-five": 35, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

/** Replace number words with digits so one set of regexes works for both. */
function normalize(text: string): string {
  let s = " " + toAsciiDigits(text.normalize("NFC").toLowerCase()).replace(/[,।!?]/g, " ") + " ";
  s = s.replace(/हजार/g, "हज़ार").replace(/गांव/g, "गाँव");
  for (const [w, n] of Object.entries(NUM_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    s = s.replace(new RegExp(`(^|\\s)${w}(?=\\s)`, "g"), `$1${n}`);
  }
  return s;
}

const has = (s: string, re: RegExp) => re.test(s);

/** True if a negation word appears within a few words after (or right before) the match. */
function negatedNear(s: string, re: RegExp): boolean {
  const m = re.exec(s);
  if (!m) return false;
  const after = s.slice(m.index, m.index + m[0].length + 40);
  const before = s.slice(Math.max(0, m.index - 20), m.index);
  return /(नहीं|नही|ना |no |not |don't|dont|nahi|nahin|without|बिना)/.test(after + " ") || /(no |not |don't|dont|बिना|nahi)/.test(before);
}

const CITIES: Record<string, string> = {
  delhi: "Delhi", दिल्ली: "Delhi", mumbai: "Maharashtra", मुंबई: "Maharashtra", pune: "Maharashtra",
  bhopal: "Madhya Pradesh", भोपाल: "Madhya Pradesh", gwalior: "Madhya Pradesh", ग्वालियर: "Madhya Pradesh",
  indore: "Madhya Pradesh", इंदौर: "Madhya Pradesh", jabalpur: "Madhya Pradesh", lucknow: "Uttar Pradesh",
  लखनऊ: "Uttar Pradesh", kanpur: "Uttar Pradesh", patna: "Bihar", पटना: "Bihar", jaipur: "Rajasthan",
  जयपुर: "Rajasthan", kolkata: "West Bengal", chennai: "Tamil Nadu", bengaluru: "Karnataka",
  bangalore: "Karnataka", hyderabad: "Telangana", ahmedabad: "Gujarat", raipur: "Chhattisgarh", ranchi: "Jharkhand",
};
const STATES: Record<string, string> = {
  "madhya pradesh": "Madhya Pradesh", "मध्य प्रदेश": "Madhya Pradesh", "uttar pradesh": "Uttar Pradesh",
  "उत्तर प्रदेश": "Uttar Pradesh", bihar: "Bihar", बिहार: "Bihar", rajasthan: "Rajasthan", राजस्थान: "Rajasthan",
  maharashtra: "Maharashtra", महाराष्ट्र: "Maharashtra", gujarat: "Gujarat", गुजरात: "Gujarat",
  chhattisgarh: "Chhattisgarh", छत्तीसगढ़: "Chhattisgarh", jharkhand: "Jharkhand", झारखंड: "Jharkhand",
  haryana: "Haryana", हरियाणा: "Haryana", punjab: "Punjab", पंजाब: "Punjab", odisha: "Odisha", ओडिशा: "Odisha",
  "west bengal": "West Bengal", "पश्चिम बंगाल": "West Bengal", "tamil nadu": "Tamil Nadu", karnataka: "Karnataka",
  kerala: "Kerala", telangana: "Telangana", "andhra pradesh": "Andhra Pradesh", assam: "Assam", असम: "Assam",
  uttarakhand: "Uttarakhand", उत्तराखंड: "Uttarakhand", "himachal pradesh": "Himachal Pradesh",
};

/** Any char except a full stop — but a decimal point ("1.8 लाख") is allowed. */
const NOT_SENTENCE_END = "(?:[^.]|\\.(?=\\d))";
const INCOME_CUE = "(कमा|कमाई|income|earn|salary|तनख्वाह|वेतन|आय|मिलते|milte|kama)";

function money(s: string): { amount: number; period: "month" | "year" | null } | null {
  // The amount can come before ("10 हज़ार कमाती") or after ("income is 10000") the cue.
  const windows = [
    s.match(new RegExp(`${NOT_SENTENCE_END}{0,40}${INCOME_CUE}`))?.[0],
    s.match(new RegExp(`${INCOME_CUE}${NOT_SENTENCE_END}{0,60}`))?.[0],
  ];
  const amountRe = /(\d+(?:\.\d+)?)\s*(लाख|lakh|lac|हज़ार|thousand|k(?![a-z])|रुपये|rupees|rs|₹)?/g;
  for (const w of windows) {
    if (!w) continue;
    for (const m of w.matchAll(amountRe)) {
      let n = parseFloat(m[1]);
      const unit = m[2] ?? "";
      if (/लाख|lakh|lac/.test(unit)) n *= 100000;
      else if (/हज़ार|thousand|k/.test(unit)) n *= 1000;
      if (n < 500) continue; // an age, a count of children, etc.
      const period = /(महीने|महीना|मासिक|month|monthly|mahine|\/month)/.test(s)
        ? "month"
        : /(सालाना|वार्षिक|annual|yearly|per year|a year|साल की कमाई)/.test(s)
          ? "year"
          : null;
      return { amount: n, period };
    }
  }
  return null;
}

export function extractProfileRules(text: string): Partial<Profile> {
  const s = normalize(text);
  const p: Partial<Profile> = {};

  // Name
  const name = /(?:मेरा नाम|my name is|i am|मैं)\s+([\p{L}\p{M}]+)\s+(?:है|हूँ|हूं|and|,)/u.exec(s);
  if (name && !/^\d/.test(name[1]) && !["एक", "a", "an", "the"].includes(name[1])) {
    if (/मेरा नाम|my name/.test(name[0])) p.name = name[1].charAt(0).toUpperCase() + name[1].slice(1);
  }

  // Age
  // Skip ordinals / dates ("1st जनवरी", "12वीं") — they are not ages.
  const age =
    /(\d{1,3})\s*(साल|वर्ष|years?|yrs?|saal|sal)/.exec(s) ??
    /(?:उम्र|आयु|age)\D{0,6}?(\d{1,3})(?!\d|\s*(st|nd|rd|th|वीं|वां|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर))/.exec(
      s.replace(/\d{1,2}\s*(st|nd|rd|th|वीं|वां)?\s*(जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर|january|february|march|april|may|june|july|august|september|october|november|december)/g, " "),
    ) ??
    /(?:उम्र|आयु|age)[^.]{0,30}?(\d{1,3})\s*(हो|है|होगी|hai)/.exec(s);
  if (age) {
    const a = parseInt(age[1], 10);
    if (a > 0 && a < 110) p.age = a;
  }

  // Marital status & gender
  if (has(s, /(विधवा|widow\b|widowed)/)) { p.maritalStatus = "widowed"; p.gender = "female"; }
  else if (has(s, /(विधुर|widower)/)) { p.maritalStatus = "widowed"; p.gender = "male"; }
  else if (has(s, /(तलाक|divorce|separated|अलग रहती|अलग रहता)/)) p.maritalStatus = "divorced";
  else if (has(s, /(अविवाहित|unmarried|single|कुंवारा|कुंवारी)/)) p.maritalStatus = "single";
  else if (has(s, /(शादीशुदा|विवाहित|married|मेरे पति|मेरी पत्नी|my husband|my wife)/)) p.maritalStatus = "married";

  if (!p.gender) {
    if (has(s, /(महिला|औरत|female|woman|lady|girl|लड़की|छात्रा|गृहिणी|housewife)/) || has(s, /ती (हूँ|हूं)/)) p.gender = "female";
    else if (has(s, /(पुरुष|आदमी|male\b|\bman\b|लड़का|boy)/) || has(s, /ता (हूँ|हूं)/)) p.gender = "male";
  }

  // Location
  for (const [k, v] of Object.entries(STATES)) if (s.includes(k)) p.state = v;
  for (const [k, v] of Object.entries(CITIES)) if (s.includes(k)) { p.state = v; p.area ??= "urban"; }
  if (has(s, /(गाँव|village|gaon|gav|ग्रामीण|rural|देहात)/)) p.area = "rural";
  else if (has(s, /(शहर|city|town|urban|शहरी|कस्बा)/)) p.area = "urban";

  // Occupation (most specific first)
  const occ: [RegExp, Profile["occupation"]][] = [
    [/(घरों में काम|घरेलू काम|घरेलू कामगार|domestic (worker|help)|\bmaid\b|कामवाली|bai\b|झाड़ू पोंछा)/, "domestic_worker"],
    [/(सरकारी नौकरी|सरकारी कर्मचारी|government (job|employee)|govt (job|employee))/, "govt_employee"],
    [/(खेत में मज़दूरी|खेत में मजदूरी|खेतिहर|खेत मज़दूर|खेत मजदूर|farm labou?r|agricultural labou?r|(मज़दूरी|मजदूरी|मजदूर|मज़दूर)[^.]{0,20}खेत)/, "agri_labourer"],
    [/(किसान|खेती|kisan|farmer|farming|kheti)/, "farmer"],
    [/(निर्माण|construction|बिल्डिंग|building site|बेलदार|मिस्त्री का हेल्पर)/, "construction_worker"],
    [/(ठेला|रेहड़ी|पटरी|फेरी|street vendor|hawker|thela|सब्ज़ी बेच|सब्जी बेच|फल बेच)/, "street_vendor"],
    [/(दर्जी|tailor|बढ़ई|carpenter|कुम्हार|potter|मोची|cobbler|नाई|barber|लोहार|blacksmith|सुनार|goldsmith|राजमिस्त्री|mason|बुनकर|weaver|धोबी|washerman|कारीगर|artisan|craftsman)/, "artisan"],
    [/(मछली पकड़|मछुआरा|मछुआरे|fisher)/, "fisherman"],
    [/(छात्र|छात्रा|student|पढ़ाई कर|पढ़ता हूँ|पढ़ती हूँ|college में|कॉलेज में)/, "student"],
    [/(बेरोज़गार|बेरोजगार|unemployed|no job|jobless|काम नहीं (है|मिल))/, "unemployed"],
    [/(गृहिणी|housewife|homemaker|घर संभालती)/, "homemaker"],
    [/(रिटायर|retired|सेवानिवृत्त)/, "retired"],
    [/(दुकान|shop|व्यापार|business|धंधा)/, "self_employed"],
    [/(प्राइवेट नौकरी|private job|company में|कंपनी में|नौकरी करता|नौकरी करती)/, "salaried_private"],
    [/(मज़दूर|मजदूर|मज़दूरी|मजदूरी|labou?rer|daily wage|दिहाड़ी)/, "construction_worker"],
  ];
  for (const [re, o] of occ) if (has(s, re)) { p.occupation = o; break; }

  // Study level (only meaningful for students)
  const study: [RegExp, Profile["studyLevel"]][] = [
    [/(m\.?\s?tech|m\.?\s?sc|m\.?\s?a\b|mba|m\.?\s?com|post.?graduat|स्नातकोत्तर|एम\.?\s?ए|पीजी)/, "pg"],
    [/(b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|b\.?\s?com|\bba\b|bca|graduation|degree|बी\.?\s?टेक|बी\.?\s?ए|बीएससी|स्नातक|कॉलेज|college)/, "ug"],
    [/(diploma|iti|polytechnic|डिप्लोमा|आईटीआई|पॉलिटेक्निक)/, "diploma"],
    [/((11|12)(वीं|th)|कक्षा (11|12)|class (11|12)|ग्यारहवीं|बारहवीं)/, "class_11_12"],
    [/((9|10)(वीं|th)|कक्षा (9|10)|class (9|10)|नौवीं|दसवीं)/, "class_9_10"],
    [/([1-8](वीं|th)|कक्षा [1-8]\b|class [1-8]\b)/, "class_1_8"],
  ];
  if (p.occupation === "student" || has(s, /(पढ़ती|पढ़ता|studying|पढ़ाई)/)) {
    for (const [re, lvl] of study) if (has(s, re)) { p.studyLevel = lvl; p.isStudent = true; break; }
  }

  // Income
  const inc = money(s);
  if (inc) p.annualIncome = inc.period === "year" || inc.amount >= 200000 ? inc.amount : inc.amount * 12;

  // Ration card / BPL
  const bpl = /(बीपीएल|bpl|अंत्योदय|antyodaya|गरीबी रेखा|राशन कार्ड|ration card|पीला कार्ड|गुलाबी कार्ड)/;
  if (has(s, bpl)) p.isBPL = !negatedNear(s, bpl);

  // Category & minority
  if (has(s, /(\bsc\b|अनुसूचित जाति|dalit|दलित|scheduled caste)/)) p.category = "sc";
  else if (has(s, /(\bst\b|अनुसूचित जनजाति|आदिवासी|adivasi|tribal|scheduled tribe)/)) p.category = "st";
  else if (has(s, /(\bobc\b|पिछड़ा|पिछड़ी|backward class)/)) p.category = "obc";
  else if (has(s, /(\bews\b)/)) p.category = "ews";
  else if (has(s, /(general category|सामान्य वर्ग|जनरल)/)) p.category = "general";
  if (has(s, /(मुस्लिम|muslim|ईसाई|christian|सिख|sikh|बौद्ध|buddhist|जैन|jain|पारसी|parsi)/)) p.isMinority = true;

  // Disability
  const dis = /(विकलांग|दिव्यांग|disabled|disability|handicap|अपाहिज|नेत्रहीन|blind|deaf|बहरा)/;
  if (has(s, dis)) {
    p.isDisabled = !negatedNear(s, dis);
    const pct = /(\d{2,3})\s*(%|प्रतिशत|percent)/.exec(s);
    if (pct) p.disabilityPercent = parseInt(pct[1], 10);
  }

  // Land
  const land = /(\d+(?:\.\d+)?)\s*(एकड़|acres?|बीघा|bigha|हेक्टेयर|hectares?)/.exec(s);
  if (land) {
    const n = parseFloat(land[1]);
    const u = land[2];
    p.landHectares = Math.round((/एकड़|acre/.test(u) ? n * 0.4047 : /बीघा|bigha/.test(u) ? n * 0.25 : n) * 100) / 100;
  } else if (p.occupation === "farmer" && has(s, /(ज़मीन नहीं|जमीन नहीं|no land|landless|बटाई)/)) p.landHectares = 0;

  // Household assets
  const lpg = /(गैस कनेक्शन|gas connection|lpg|सिलेंडर|cylinder|गैस)/;
  if (has(s, lpg)) p.hasLpgConnection = !negatedNear(s, lpg) && !has(s, /(लकड़ी|चूल्हे पर|chulha|firewood)/);
  else if (has(s, /(लकड़ी पर खाना|चूल्हे पर खाना|chulha|firewood)/)) p.hasLpgConnection = false;
  if (has(s, /(कच्चा घर|कच्चे घर|kutcha|kachcha|बेघर|homeless|झुग्गी|slum|किराये|किराए|rent)/)) p.ownsPuccaHouse = false;
  else if (has(s, /(पक्का घर|pucca house|अपना घर|own house|own home)/)) p.ownsPuccaHouse = !negatedNear(s, /(पक्का घर|pucca house|अपना घर|own house|own home)/);
  const bank = /(बैंक खाता|बैंक अकाउंट|bank account|bank khata)/;
  if (has(s, bank)) p.hasBankAccount = !negatedNear(s, bank);
  const toilet = /(शौचालय|toilet|latrine)/;
  if (has(s, toilet)) p.hasToilet = !negatedNear(s, toilet);

  // Family
  if (has(s, /(गर्भवती|pregnant|प्रेग्नेंट|पेट से)/)) { p.isPregnantOrLactating = true; p.gender = "female"; }
  if (has(s, /(स्कूल|school)/) && has(s, /(बच्च|बेटा|बेटी|child|kids|son|daughter)/)) p.hasSchoolChildren = true;
  if (has(s, /(छोटा बच्चा|छोटी बच्ची|नवजात|baby|infant|toddler|आंगनवाड़ी)/)) p.hasChildUnder6 = true;
  const girl = /(बेटी|daughter)\D{0,15}(\d{1,2})\s*(साल|years?)/.exec(s);
  if (girl && parseInt(girl[2], 10) < 10) p.hasGirlChildUnder10 = true;

  // Life events & intentions
  if (has(s, /(पति|husband|पत्नी|wife|पिता|father)[^.]{0,25}(मौत|मृत्यु|निधन|गुज़र|गुजर|died|passed away|death)/) &&
      has(s, /(पिछले साल|last year|इस साल|this year|हाल ही|recently|महीने पहले|months? ago)/)) p.breadwinnerDiedRecently = true;
  if (has(s, /(व्यापार शुरू|business शुरू|धंधा शुरू|दुकान खोल|start (a|my) business|own business|स्वरोज़गार शुरू)/)) p.wantsToStartBusiness = true;
  if (has(s, /(इनकम टैक्स भर|income tax (pay|file)|pay income tax|टैक्स भरता|टैक्स भरती)/)) p.isIncomeTaxPayer = !negatedNear(s, /(टैक्स|tax)/);

  return p;
}

// \b doesn't work for Devanagari, so end-of-word is "whitespace, punctuation or end".
const YES = /^\s*(जी हाँ|हाँ|हां|हा|जी|yes|yeah|yep|haan|han|ha|है|सही)(?=[\s,.!।]|$)/iu;
const NO = /^\s*(जी नहीं|नहीं|नही|ना|no|nope|nahi|nahin|nhi)(?=[\s,.!।]|$)/iu;

/** Interpret a short yes/no reply to a yes/no question the assistant just asked. */
export function parseYesNo(text: string): boolean | null {
  if (NO.test(text)) return false;
  if (YES.test(text)) return true;
  return null;
}

/** First number in a spoken/typed answer ("पैंतीस साल", "35", "thirty five"). */
export function parseNumber(text: string): number | null {
  const s = normalize(text);
  // "30 5" from "thirty five" → 35
  const m = /(\d+(?:\.\d+)?)(?:\s+(\d))?(?!\d)/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] && n % 10 === 0 && n >= 20 ? n + parseInt(m[2], 10) : n;
}

/**
 * Map a spoken answer to one of a question's options: first by what the
 * extractor understands for that field, then yes/no, then by option label words.
 */
export function matchSpokenOption<T>(
  text: string,
  field: string | undefined,
  options: { value: T; label: { en: string; hi: string } }[],
): T | undefined {
  if (field) {
    const v = (extractProfileRules(text) as Record<string, unknown>)[field];
    const hit = options.find((o) => o.value === v);
    if (hit) return hit.value;
  }
  const yn = parseYesNo(text);
  if (yn !== null) {
    const hit = options.find((o) => o.value === yn);
    if (hit) return hit.value;
  }
  const said = normalize(text);
  let best: { v: T; score: number } | undefined;
  for (const o of options) {
    const words = `${o.label.hi} ${o.label.en}`.toLowerCase().split(/[\s/,()–-]+/).filter((w) => w.length > 1);
    const score = words.filter((w) => said.includes(w)).length;
    if (score && (!best || score > best.score)) best = { v: o.value, score };
  }
  return best?.v;
}
