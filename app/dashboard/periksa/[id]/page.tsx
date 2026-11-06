import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExamWorkspace } from "@/components/dash/Exam";
import { getAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Rekam medis kunjungan" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { user } = (await getAuth())!;
  if (!can(user.role, "exam:read-basic")) redirect("/tidak-berwenang");
  return <ExamWorkspace id={(await params).id} role={user.role as "superadmin" | "dokter" | "staf"} />;
}
