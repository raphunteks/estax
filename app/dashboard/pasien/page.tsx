import type { Metadata } from "next";
import { PatientList } from "@/components/dash/Patients";
import { getAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Pasien" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return <PatientList canCreate={can(user.role, "patients:create")} />;
}
