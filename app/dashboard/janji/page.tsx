import type { Metadata } from "next";
import Appointments from "@/components/dash/Appointments";
import { getAuth } from "@/lib/auth/session";
import { getPatient } from "@/lib/clinic/patients";

export const metadata: Metadata = { title: "Janji & Antrian" };

export default async function Page({ searchParams }: { searchParams: Promise<{ patient?: string; tab?: string }> }) {
  const { user } = (await getAuth())!;
  const sp = await searchParams;
  const id = sp.patient;
  const p = id && user.role !== "dokter" ? await getPatient(id) : null;
  return <Appointments role={user.role as "superadmin" | "dokter" | "staf"} userId={user.id} tab={sp.tab} patient={p ? { id: p.id, name: p.name, rmNo: p.rmNo ?? null } : undefined} />;
}
