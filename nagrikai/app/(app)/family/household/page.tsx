"use client";

import { useRouter } from "next/navigation";
import { useFamily } from "@/components/FamilyProvider";
import Wizard from "@/components/Wizard";
import { api, usePrefs } from "@/components/ui";
import { answersToProfile, profileToAnswers } from "@/lib/wizard";

export default function EditHousehold() {
  const { data, refresh } = useFamily();
  const { lang } = usePrefs();
  const router = useRouter();
  if (!data) return null;
  return (
    <Wizard
      mode="household"
      title={lang === "hi" ? "घर की जानकारी" : "Home details"}
      initial={profileToAnswers(data.family.household)}
      submitLabel={{ en: "Save", hi: "सेव करें" }}
      onExit={() => router.push("/family")}
      onSubmit={async (a) => {
        await api("/api/family/household", "PATCH", { household: answersToProfile(a), replace: true });
        await refresh();
        router.replace("/home");
      }}
    />
  );
}
