import { describe, expect, it } from "vitest";
import { answerQuestion, type Person } from "@/lib/assistant";
import { memberProfile, type Family } from "@/lib/family";
import { SCHEMES } from "@/lib/kb";

const family: Family = {
  id: "f", code: "X",
  household: { state: "Madhya Pradesh", district: "Bhopal", area: "urban", annualIncome: 120000, category: "sc", isBPL: true, ownsPuccaHouse: false, hasLpgConnection: false },
  members: [
    { id: "m1", name: "सुनीता", relation: "self", isHead: true, status: "active", hasLogin: true, profile: { age: 35, gender: "female", maritalStatus: "widowed", occupation: "domestic_worker", hasBankAccount: true, isDisabled: false } },
    { id: "m2", name: "अनिल", relation: "son", isHead: false, status: "active", hasLogin: false, profile: { age: 21, gender: "male", maritalStatus: "single", occupation: "unemployed", hasBankAccount: true, isDisabled: false } },
    { id: "m3", name: "पूजा", relation: "daughter", isHead: false, status: "active", hasLogin: false, profile: { age: 15, gender: "female", isStudent: true, studyLevel: "class_9_10", isDisabled: false } },
  ],
};
const people: Person[] = family.members.map((m) => ({ id: m.id, name: m.name, relation: m.relation, profile: memberProfile(family, m) }));
const ask = (question: string, lang: "hi" | "en" = "hi") => answerQuestion({ question, lang, people, all: SCHEMES });
const ids = (a: ReturnType<typeof ask>) => a.schemes.map((s) => s.id);

describe("the nine questions that failed in the 1 Oct 2026 review", () => {
  it("widow pension → Kalyani pension", () => {
    const a = ask("मुझे विधवा पेंशन कैसे मिलेगी");
    expect(a.kind).toBe("scheme");
    expect(ids(a)[0]).toBe("mp-kalyani-pension");
  });
  it("payment not received → troubleshooting, not an eligibility speech", () => {
    const a = ask("लाड़ली बहना का पैसा क्यों नहीं आया");
    expect(a.kind).toBe("problem");
    expect(a.text).toMatch(/DBT/);
    expect(a.text).toMatch(/नए पंजीयन अभी बंद/);
    expect(a.text).toMatch(/181/);
  });
  it("application rejected → next steps and 181", () => {
    const a = ask("मेरा आवेदन रिजेक्ट हो गया अब क्या करूँ");
    expect(a.kind).toBe("problem");
    expect(a.text).toMatch(/अपील|181/);
  });
  it("difference between two cards → both described", () => {
    const a = ask("आयुष्मान कार्ड और संबल कार्ड में क्या फर्क है");
    expect(a.kind).toBe("compare");
    expect(ids(a)).toEqual(expect.arrayContaining(["pmjay", "mp-sambal"]));
  });
  it("greeting and 'who are you' → conversation", () => {
    expect(ask("नमस्ते").kind).toBe("smalltalk");
    expect(ask("नमस्ते आप कौन हो").kind).toBe("smalltalk");
  });
  it("how to get a Samagra ID → how-to article with official link", () => {
    const a = ask("समग्र ID कैसे बनवाएँ");
    expect(a.kind).toBe("howto");
    expect(a.link?.url).toContain("samagra.gov.in");
  });
  it("'my son can't find a job' → answers for the son", () => {
    const a = ask("मेरे बेटे की नौकरी नहीं लग रही");
    expect(a.schemes[0].for).toBe("अनिल");
    expect(ids(a)).toContain("mp-seekho-kamao");
  });
  it("which scheme pays the most → ranked list", () => {
    const a = ask("कौन सी योजना में सबसे ज़्यादा पैसा मिलेगा");
    expect(a.kind).toBe("ranking");
    expect(a.schemes.length).toBeGreaterThan(1);
    expect(ids(a)).not.toContain("mp-ladli-behna"); // closed intake is never promised
  });
  it("Hinglish: add a name to the ration card → how-to", () => {
    const a = ask("ration card me naam kaise jode");
    expect(a.kind).toBe("howto");
    expect(a.text).toMatch(/समग्र/);
  });
});

describe("more everyday questions", () => {
  it.each([
    ["आय प्रमाण पत्र कैसे बनेगा", "howto"],
    ["जाति प्रमाण पत्र कहाँ से बनवाएँ", "howto"],
    ["बैंक खाते से आधार कैसे जोड़ें", "howto"],
    ["पटवारी पैसे माँग रहा है शिकायत कहाँ करूँ", "howto"],
    ["आयुष्मान कार्ड कैसे बनवाएँ", "howto"],
    ["मेरे परिवार को कौन सी योजनाएँ मिल सकती हैं", "ranking"],
    ["धन्यवाद", "smalltalk"],
    ["पेंशन की किस्त रुक गई है", "problem"],
    ["what can you do", "smalltalk"],
  ])("%s → %s", (q, kind) => {
    expect(ask(q).kind).toBe(kind);
  });
  it("daughter's education → her scholarship, named", () => {
    const a = ask("बेटी की पढ़ाई के लिए क्या मिलेगा");
    expect(a.schemes.every((s) => s.for === "पूजा")).toBe(true);
    expect(a.schemes.some((s) => s.category === "education")).toBe(true);
  });
  it("documents for a named scheme", () => {
    const a = ask("उज्ज्वला के लिए कौन से दस्तावेज़ चाहिए");
    expect(ids(a)[0]).toBe("pmuy");
    expect(a.text).toMatch(/आधार कार्ड/);
  });
  it("gibberish → honest fallback with suggestions, never a random scheme", () => {
    const a = ask("asdf qwer zxcv");
    expect(a.kind).toBe("none");
    expect(a.suggestions.length).toBeGreaterThan(0);
  });
  it("answers in English too", () => {
    expect(ask("How do I get a Samagra ID?", "en").text).toMatch(/Samagra/);
  });
});

describe("Roman-script Hindi works even without a language model", () => {
  it.each([
    ["ghar banane ke liye paisa chahiye", "housing"],
    ["mujhe pension chahiye", "pension"],
    ["beti ki padhai ke liye scholarship", "education"],
    ["gas cylinder kaise milega", "energy"],
  ])("%s → a %s scheme", (q, category) => {
    const a = ask(q);
    expect(a.schemes.some((s) => s.category === category)).toBe(true);
  });
  it("ration card me naam kaise jode → the add-a-name article, not the new-card one", () => {
    expect(ask("ration card me naam kaise jode").text).toMatch(/नाम जोड़ना/);
  });
});

describe("Unicode forms", () => {
  it("precomposed ड़ (as language models and some keyboards produce) matches the same as ड + nukta", () => {
    const precomposed = "राशन कार्ड में नाम कैसे जोड़ें"; // जोड़ें with U+095C
    expect(ask(precomposed).kind).toBe("howto");
    expect(ask("लाड़ली बहना का पैसा नहीं आया").schemes[0]?.id).toBe("mp-ladli-behna");
  });
  it("an unrelated question gets no scheme chips", () => {
    const a = ask("भारत का प्रधानमंत्री कौन है");
    expect(a.kind).toBe("none");
    expect(a.schemes).toEqual([]);
  });
});
