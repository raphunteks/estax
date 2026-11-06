import type { Metadata } from "next";
import { PatientProfile } from "@/components/dash/Patients";
import { getAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Profil pasien" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { user } = (await getAuth())!;
  return <PatientProfile id={(await params).id} canVerify={can(user.role, "patients:verify")} canBook={can(user.role, "appointments:create")} role={user.role as "superadmin" | "dokter" | "staf"} userId={user.id} />;
}
