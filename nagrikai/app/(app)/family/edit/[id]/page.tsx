"use client";

import { useParams, useRouter } from "next/navigation";
import { useFamily } from "@/components/FamilyProvider";
import Wizard from "@/components/Wizard";
import { api } from "@/components/ui";
import { answersToProfile, profileToAnswers } from "@/lib/wizard";

export default function EditMember() {
  const { id } = useParams<{ id: string }>();
  const { data, refresh } = useFamily();
  const router = useRouter();
  const m = data?.family.members.find((x) => x.id === id);
  if (!m) return null;
  return (
    <Wizard
      mode="edit"
      title={m.name}
      initial={{ ...profileToAnswers(m.profile), name: m.name }}
      submitLabel={{ en: "Save", hi: "सेव करें" }}
      onExit={() => router.push("/family")}
      onSubmit={async (a) => {
        const { name, ...profile } = answersToProfile(a);
        await api(`/api/family/members/${id}`, "PATCH", { name, profile });
        await refresh();
        router.replace("/family");
      }}
    />
  );
}
