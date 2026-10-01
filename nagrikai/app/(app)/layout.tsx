import { FamilyProvider } from "@/components/FamilyProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <FamilyProvider>{children}</FamilyProvider>;
}
