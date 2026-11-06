import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RegisterWizard from "@/components/auth/RegisterWizard";
import { getAuth } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Daftar pasien",
  description: "Daftar sebagai pasien baru Estaka Dental Clinic untuk membuat janji online dengan dokter gigi.",
  alternates: { canonical: "/daftar" },
};
export default async function Page() {
  const a = await getAuth();
  if (a) redirect(homeFor(a.user.role));
  return <RegisterWizard />;
}
