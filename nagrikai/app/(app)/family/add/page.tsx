"use client";

import { useRouter } from "next/navigation";
import { useFamily } from "@/components/FamilyProvider";
import Wizard from "@/components/Wizard";
import { api, usePrefs } from "@/components/ui";
import { answersToProfile } from "@/lib/wizard";

export default function AddMember() {
  const { refresh } = useFamily();
  const { lang } = usePrefs();
  const router = useRouter();
  return (
    <Wizard
      mode="member"
      title={lang === "hi" ? "सदस्य जोड़ें" : "Add member"}
      submitLabel={{ en: "All correct — add", hi: "सब सही है — जोड़ें" }}
      onExit={() => router.push("/family")}
      onSubmit={async (a) => {
        const { id } = await api<{ id: string }>("/api/family/members", "POST", { name: a.name, relation: a.relation ?? "other", profile: answersToProfile(a) });
        await refresh();
        router.replace(`/home?who=${id}`);
      }}
    />
  );
}
