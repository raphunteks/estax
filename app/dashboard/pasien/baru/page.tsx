import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RegisterWizard from "@/components/auth/RegisterWizard";
import { getAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Pasien baru" };
export default async function Page() {
  const { user } = (await getAuth())!;
  if (!can(user.role, "patients:create")) redirect("/tidak-berwenang");
  return <RegisterWizard staff />;
}
