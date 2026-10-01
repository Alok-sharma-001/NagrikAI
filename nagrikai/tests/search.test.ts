import { expect, it } from "vitest";
import { searchSchemes } from "@/lib/search";

it.each([
  ["गैस कनेक्शन कैसे मिलेगा", "pmuy"],
  ["मेरी बेटी की पढ़ाई के लिए छात्रवृत्ति", "pms-sc"],
  ["अस्पताल का इलाज मुफ्त", "pmjay"],
  ["PM Kisan ka paisa kab aayega", "pm-kisan"],
  ["घर बनाने के लिए पैसा", "pmay-g"],
])("%s → includes %s", (q, id) => {
  expect(searchSchemes(q).map((s) => s.id)).toContain(id);
});
