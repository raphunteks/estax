import type { Metadata } from "next";
import PortalAppts from "@/components/dash/PortalAppts";
import { getAuth } from "@/lib/auth/session";
import { patientOfUser } from "@/lib/clinic/patients";

export const metadata: Metadata = { title: "Janji saya" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return <PortalAppts noPatient={!(await patientOfUser(user.id))} />;
}
