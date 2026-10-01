import type { Family, FamilyMatch } from "./family";
import type { Text } from "./types";

/**
 * Life-event alerts: the family data already says who is about to cross a line that
 * matters (a daughter's first birthday, the 40th birthday that closes pension schemes,
 * turning 60, a Class 12 result). The citizen shouldn't have to know the rule.
 */

export type Alert = { id: string; icon: string; urgent: boolean; title: Text; text: Text; schemeId?: string; memberName?: string };
type Statuses = Record<string, "receiving" | "applied" | "rejected">;

export function familyAlerts(family: Family, match: FamilyMatch, statuses: Statuses, today = new Date()): Alert[] {
  const out: Alert[] = [];
  const active = family.members.filter((m) => m.status === "active");
  const result = (schemeId: string) => match.schemes.find((s) => s.scheme.id === schemeId);
  /** Could this member (or the family, memberId "") get the scheme, and are they not yet receiving it? */
  const open = (schemeId: string, memberId: string) => {
    const r = result(schemeId);
    if (!r) return false;
    const key = `${schemeId}|${r.level === "household" ? "" : memberId}`;
    if (statuses[key] === "receiving") return false;
    const v = r.level === "household" ? r.verdict : r.members.find((m) => m.memberId === memberId)?.verdict;
    return v === "eligible" || v === "possible";
  };

  for (const m of active) {
    const { age, gender } = m.profile;
    if (age === undefined) continue;
    const who = m.name;

    if (gender === "female" && age <= 1 && open("mp-ladli-laxmi", m.id))
      out.push({ id: `ll-${m.id}`, icon: "👶", urgent: true, schemeId: "mp-ladli-laxmi", memberName: who,
        title: { en: `Register ${who} for Ladli Laxmi before her first birthday`, hi: `${who} का लाड़ली लक्ष्मी में पंजीयन पहले जन्मदिन से पहले कराएँ` },
        text: { en: "Registration at the Anganwadi must be done within one year of birth — ₹1,43,000 over her schooling.", hi: "आंगनवाड़ी में पंजीयन जन्म के एक वर्ष के भीतर ज़रूरी है — पढ़ाई के दौरान कुल ₹1,43,000।" } });

    if (gender === "female" && age < 10 && age > 1 && open("ssy", m.id))
      out.push({ id: `ssy-${m.id}`, icon: "🏦", urgent: age >= 8, schemeId: "ssy", memberName: who,
        title: { en: `Open ${who}'s Sukanya account before she turns 10`, hi: `${who} का सुकन्या खाता 10 साल की होने से पहले खोलें` },
        text: { en: `${10 - age} year(s) left. High-interest, tax-free savings for her education and marriage.`, hi: `${10 - age} साल बचे हैं। पढ़ाई और शादी के लिए ऊँचे ब्याज वाली, कर-मुक्त बचत।` } });

    if (age >= 37 && age <= 39) {
      const s = ["apy", "pm-sym", "pm-kmy"].find((id) => open(id, m.id));
      if (s)
        out.push({ id: `p40-${m.id}`, icon: "⏳", urgent: true, schemeId: s, memberName: who,
          title: { en: `${who}: join a pension scheme before turning 40`, hi: `${who}: 40 साल से पहले पेंशन योजना से जुड़ें` },
          text: { en: `Only ${40 - age} year(s) left. Atal Pension / Shram Yogi Maan-dhan close at 40 — after that this pension is not available.`, hi: `सिर्फ़ ${40 - age} साल बचे हैं। अटल पेंशन / श्रम योगी मान-धन में 40 के बाद प्रवेश नहीं मिलता।` } });
    }

    if (age >= 48 && age <= 50 && open("pmjjby", m.id))
      out.push({ id: `p50-${m.id}`, icon: "🛡️", urgent: age === 50, schemeId: "pmjjby", memberName: who,
        title: { en: `${who}: take the ₹2 lakh life cover before 50`, hi: `${who}: 50 साल से पहले ₹2 लाख का जीवन बीमा ले लें` },
        text: { en: "PM Jeevan Jyoti Bima accepts new members only up to age 50 — ₹436 a year.", hi: "प्रधानमंत्री जीवन ज्योति बीमा में 50 साल तक ही प्रवेश मिलता है — ₹436 सालाना।" } });

    if (age >= 58 && age <= 59)
      out.push({ id: `p60-${m.id}`, icon: "👵", urgent: false, memberName: who,
        title: { en: `${who} turns 60 soon — get ready for senior benefits`, hi: `${who} जल्द 60 के होंगे — वरिष्ठ नागरिक लाभ की तैयारी करें` },
        text: { en: "Keep age proof and Samagra e-KYC ready: old-age pension and Teerth Darshan open at 60.", hi: "आयु प्रमाण और समग्र e-KYC तैयार रखें: 60 पर वृद्धावस्था पेंशन और तीर्थ दर्शन खुलते हैं।" } });

    if (age >= 60 && open("mp-vriddha-pension", m.id) && result("mp-vriddha-pension")?.members.find((x) => x.memberId === m.id)?.verdict === "eligible")
      out.push({ id: `vp-${m.id}`, icon: "👵", urgent: true, schemeId: "mp-vriddha-pension", memberName: who,
        title: { en: `${who} can get the old-age pension now`, hi: `${who} को वृद्धावस्था पेंशन अभी मिल सकती है` },
        text: { en: "₹600 a month. Apply at the Gram Panchayat / municipal office with Samagra ID.", hi: "हर महीने ₹600। समग्र ID के साथ ग्राम पंचायत / नगर निगम में आवेदन करें।" } });

    if (m.profile.maritalStatus === "widowed" && gender === "female" && open("mp-kalyani-pension", m.id))
      out.push({ id: `kp-${m.id}`, icon: "🕊️", urgent: true, schemeId: "mp-kalyani-pension", memberName: who,
        title: { en: `${who} can get the Kalyani pension`, hi: `${who} को कल्याणी पेंशन मिल सकती है` },
        text: { en: "₹600 a month from age 18 — no BPL card needed. Keep the husband's death certificate ready.", hi: "18 साल की उम्र से हर महीने ₹600 — BPL कार्ड ज़रूरी नहीं। पति का मृत्यु प्रमाण पत्र तैयार रखें।" } });

    if (m.profile.studyLevel === "class_11_12")
      out.push({ id: `c12-${m.id}`, icon: "🎓", urgent: false, schemeId: "mp-laptop", memberName: who,
        title: { en: `${who}'s Class 12 result opens several benefits`, hi: `${who} के 12वीं के नतीजे से कई लाभ खुलेंगे` },
        text: { en: "75%+ → ₹25,000 for a laptop · 70%+ (MP Board) → college fees under Medhavi · girls with 60%+ → Gaon Ki Beti / Pratibha Kiran.", hi: "75%+ → लैपटॉप के लिए ₹25,000 · 70%+ (MP बोर्ड) → मेधावी योजना में कॉलेज फ़ीस · 60%+ वाली बेटियाँ → गाँव की बेटी / प्रतिभा किरण।" } });

    if (m.profile.isPregnantOrLactating && (open("pmmvy", m.id) || open("jsy", m.id)))
      out.push({ id: `preg-${m.id}`, icon: "🤰", urgent: true, schemeId: "pmmvy", memberName: who,
        title: { en: `${who}: register the pregnancy early`, hi: `${who}: गर्भावस्था का पंजीयन जल्दी कराएँ` },
        text: { en: "Register with the ASHA / Anganwadi now — Matru Vandana ₹5,000, delivery incentive, and ₹16,000 for Sambal card holders.", hi: "अभी आशा / आंगनवाड़ी में पंजीयन कराएँ — मातृ वंदना ₹5,000, प्रसव प्रोत्साहन, और संबल कार्ड पर ₹16,000।" } });

    if (age === 5)
      out.push({ id: `sch-${m.id}`, icon: "🏫", urgent: false, memberName: who,
        title: { en: `${who} starts school next year`, hi: `${who} अगले साल स्कूल जाएगा/जाएगी` },
        text: { en: "Enrol in the government school at 6: free books, uniform and mid-day meal. Add the child to Samagra first.", hi: "6 साल पर शासकीय स्कूल में दाखिला कराएँ: मुफ़्त किताबें, गणवेश और मध्याह्न भोजन। पहले बच्चे को समग्र में जुड़वाएँ।" } });
  }

  // Last dates within the next 45 days for schemes the family can still take.
  const soon = today.getTime() + 45 * 86400_000;
  for (const r of match.reminders) {
    if (!r.date) continue;
    const t = new Date(r.date + "T00:00:00").getTime();
    const res = result(r.schemeId);
    if (t < today.getTime() || t > soon || res?.verdict !== "eligible") continue;
    const days = Math.ceil((t - today.getTime()) / 86400_000);
    out.push({ id: `d-${r.schemeId}`, icon: "📅", urgent: days <= 15, schemeId: r.schemeId,
      title: { en: `${days} days left: ${r.title.en}`, hi: `${days} दिन बचे: ${r.title.hi}` },
      text: r.note });
  }

  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 8);
}
