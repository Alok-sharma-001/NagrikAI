"use client";

import { useRouter } from "next/navigation";
import Wizard from "@/components/Wizard";
import { api, usePrefs } from "@/components/ui";
import { answersToProfile } from "@/lib/wizard";

export default function Join() {
  const { lang } = usePrefs();
  const router = useRouter();
  const hi = lang === "hi";
  return (
    <Wizard
      mode="join"
      title={hi ? "परिवार से जुड़ें" : "Join family"}
      submitLabel={{ en: "All correct — join", hi: "सब सही है — जुड़ें" }}
      onExit={() => router.push("/")}
      onSubmit={async (a) => {
        try {
          await api("/api/auth/join", "POST", {
            code: a.code,
            name: a.name,
            relation: a.relation ?? "other",
            profile: answersToProfile(a),
            mobile: a.mobile,
            pin: a.pin,
            consent: a.consent === true,
          });
          router.replace("/home");
        } catch (e) {
          const err = e as Error & { code?: string };
          if (err.code === "BAD_CODE") return { error: hi ? "यह परिवार कोड नहीं मिला। दोबारा जाँचें।" : "Family code not found. Please check.", goTo: "code" };
          if (err.code === "MOBILE_TAKEN") return { error: hi ? "यह मोबाइल नंबर पहले से पंजीकृत है।" : "This mobile is already registered.", goTo: "mobile" };
          return { error: hi ? "कुछ गड़बड़ हुई, फिर से कोशिश करें।" : "Something went wrong, please try again." };
        }
      }}
    />
  );
}
