import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExamQueue } from "@/components/dash/Exam";
import { getAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Pemeriksaan" };
export default async function Page() {
  const { user } = (await getAuth())!;
  if (!can(user.role, "exam:read-basic")) redirect("/dashboard");
  return (
    <>
      <h1 className="display mb-6 text-3xl">Pemeriksaan hari ini</h1>
      <ExamQueue />
    </>
  );
}
