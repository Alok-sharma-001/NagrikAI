import { describe, expect, it } from "vitest";
import { extractProfileRules, parseYesNo } from "@/lib/extract";

describe("rule-based extraction", () => {
  it("parses the Priya demo sentence in Hindi", () => {
    const p = extractProfileRules(
      "मेरा नाम प्रिया है, मैं 35 साल की विधवा हूँ, दिल्ली में घरों में काम करती हूँ, महीने के दस हज़ार कमाती हूँ, मेरे दो बच्चे हैं जो स्कूल जाते हैं, मेरे पास बीपीएल राशन कार्ड है।",
    );
    expect(p).toMatchObject({
      name: "प्रिया", age: 35, maritalStatus: "widowed", gender: "female", state: "Delhi", area: "urban",
      occupation: "domestic_worker", annualIncome: 120000, isBPL: true, hasSchoolChildren: true,
    });
  });
  it("parses an English farmer description", () => {
    const p = extractProfileRules("I am a 52 year old farmer from a village in Madhya Pradesh with 1.5 acres of land. We have no gas connection and a kutcha house.");
    expect(p).toMatchObject({ age: 52, occupation: "farmer", area: "rural", state: "Madhya Pradesh", hasLpgConnection: false, ownsPuccaHouse: false });
    expect(p.landHectares).toBeCloseTo(0.61, 1);
  });
  it("handles negation", () => {
    expect(extractProfileRules("मेरे पास गैस कनेक्शन नहीं है").hasLpgConnection).toBe(false);
    expect(extractProfileRules("मेरा बैंक खाता है").hasBankAccount).toBe(true);
    expect(extractProfileRules("I don't have a bank account").hasBankAccount).toBe(false);
  });
  it("reads yes/no replies", () => {
    expect(parseYesNo("नहीं")).toBe(false);
    expect(parseYesNo("हाँ जी")).toBe(true);
    expect(parseYesNo("मुझे नहीं पता")).toBe(null);
  });
});

describe("demo examples parse offline", () => {
  it("Ramesh (Hindi)", () => {
    const p = extractProfileRules("मैं रमेश हूँ, 52 साल का किसान, मध्य प्रदेश के गाँव में रहता हूँ, डेढ़ एकड़ ज़मीन है, बीपीएल कार्ड है, कच्चा घर है और गैस कनेक्शन नहीं है।");
    expect(p).toMatchObject({ age: 52, gender: "male", occupation: "farmer", area: "rural", isBPL: true, ownsPuccaHouse: false, hasLpgConnection: false });
    expect(p.landHectares).toBeCloseTo(0.61, 1);
  });
  it("Ananya (Hindi)", () => {
    const p = extractProfileRules("मैं अनन्या हूँ, 19 साल की छात्रा हूँ, अनुसूचित जाति से हूँ, कॉलेज में बी.टेक पढ़ती हूँ, परिवार की सालाना आय 1.8 लाख है।");
    expect(p).toMatchObject({ age: 19, gender: "female", category: "sc", occupation: "student", studyLevel: "ug", isStudent: true, annualIncome: 180000 });
  });
  it("Ananya (English)", () => {
    const p = extractProfileRules("I'm Ananya, a 19 year old SC student studying B.Tech in college. My family's annual income is 1.8 lakh.");
    expect(p).toMatchObject({ age: 19, category: "sc", occupation: "student", studyLevel: "ug", annualIncome: 180000 });
  });
});

describe("regressions from production-readiness review", () => {
  it("does not read a date ordinal as age", () => {
    expect(extractProfileRules("मेरी उम्र 1st जनवरी को 40 हो जाएगी").age).toBe(40);
  });
  it("farm labour regardless of word order", () => {
    expect(extractProfileRules("मैं मजदूरी करता हूँ, खेत में").occupation).toBe("agri_labourer");
  });
});
