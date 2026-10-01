"use client";

import { PageShell } from "@/components/Shell";
import { Panel, usePrefs } from "@/components/ui";
import { SCHEMES } from "@/lib/kb";

const FAQ = [
  {
    q: { en: "Is NagrikAI a government website?", hi: "क्या नागरिक AI सरकारी वेबसाइट है?" },
    a: {
      en: "No. It is an independent citizen-assistance service. It uses official scheme rules to guide you, but the final decision is always made by the concerned government office.",
      hi: "नहीं। यह एक स्वतंत्र नागरिक-सहायता सेवा है। यह आधिकारिक योजना नियमों से मार्गदर्शन देती है, पर अंतिम निर्णय हमेशा संबंधित सरकारी कार्यालय करता है।",
    },
  },
  {
    q: { en: "Do I have to pay anything?", hi: "क्या कोई पैसा देना होगा?" },
    a: { en: "No. NagrikAI is free, and most government schemes are free to apply for. Never pay an agent.", hi: "नहीं। नागरिक AI मुफ़्त है, और ज़्यादातर सरकारी योजनाओं में आवेदन मुफ़्त है। किसी दलाल को पैसे न दें।" },
  },
  {
    q: { en: "I can't read well. Can I still use it?", hi: "मुझे ठीक से पढ़ना नहीं आता। क्या मैं इसे चला सकता/सकती हूँ?" },
    a: {
      en: "Yes. Every question is read aloud (🔊), you can answer by speaking (🎤) or by tapping pictures, and you can make the text bigger with अ+ at the top.",
      hi: "हाँ। हर सवाल बोलकर सुनाया जाता है (🔊), आप बोलकर (🎤) या तस्वीर छूकर जवाब दे सकते हैं, और ऊपर अ+ से अक्षर बड़े कर सकते हैं।",
    },
  },
  {
    q: { en: "How do my family members join?", hi: "परिवार के सदस्य कैसे जुड़ें?" },
    a: {
      en: "After registering you get a 6-letter family code. Members with a phone choose “Join my family” and enter the code; the family head approves them. Children and elders without a phone can be added from “My Family”.",
      hi: "पंजीकरण के बाद आपको 6 अक्षरों का परिवार कोड मिलता है। जिनके पास फ़ोन है वे “परिवार से जुड़ें” चुनकर कोड डालें; परिवार के मुखिया मंज़ूरी देंगे। बच्चों और बुज़ुर्गों को “मेरा परिवार” से जोड़ा जा सकता है।",
    },
  },
  {
    q: { en: "What information do you keep?", hi: "आप कौन सी जानकारी रखते हैं?" },
    a: {
      en: "Only what is needed to check schemes (age, work, ration card type, etc.), with your consent. We never ask for Aadhaar or bank numbers. The family head can delete all data any time from “My Family”.",
      hi: "केवल वही जानकारी जो योजनाएँ जाँचने के लिए ज़रूरी है (उम्र, काम, राशन कार्ड का प्रकार आदि), आपकी सहमति से। हम कभी आधार या बैंक नंबर नहीं माँगते। परिवार के मुखिया “मेरा परिवार” से कभी भी सारी जानकारी मिटा सकते हैं।",
    },
  },
];

export default function Help() {
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const helplines = [...new Map(SCHEMES.filter((s) => s.helpline).map((s) => [s.helpline!, s])).values()];
  return (
    <PageShell title={hi ? "सहायता और हेल्पलाइन" : "Help & helplines"}>
      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <Panel title={hi ? "अक्सर पूछे जाने वाले सवाल" : "Frequently asked questions"} icon="❓">
          <div className="divide-y divide-line">
            {FAQ.map((f) => (
              <details key={f.q.en} className="group py-3">
                <summary className="cursor-pointer list-none font-semibold">
                  <span className="mr-2 inline-block text-primary transition group-open:rotate-90">›</span>
                  {f.q[lang]}
                </summary>
                <p className="mt-2 pl-5 leading-relaxed text-muted">{f.a[lang]}</p>
              </details>
            ))}
          </div>
        </Panel>
        <Panel title={hi ? "योजना हेल्पलाइन" : "Scheme helplines"} icon="📞">
          <ul className="divide-y divide-line text-sm">
            {helplines.map((s) => (
              <li key={s.helpline} className="flex items-center justify-between gap-3 py-2.5">
                <span>{s.name[lang]}</span>
                <a href={`tel:${s.helpline!.replace(/-/g, "")}`} className="shrink-0 rounded-md bg-good-soft px-2.5 py-1 font-semibold text-good">{s.helpline}</a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {hi ? "किसी भी योजना में मदद के लिए नज़दीकी CSC (जन सेवा केंद्र), ग्राम पंचायत या नगर निगम कार्यालय भी जा सकते हैं।" : "For any scheme you can also visit your nearest CSC (Common Service Centre), Gram Panchayat or municipal office."}
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
