import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getAuth } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun pasien atau staf Estaka Dental Clinic untuk melihat janji dan rekam medis.",
  alternates: { canonical: "/masuk" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const a = await getAuth();
  if (a) redirect(homeFor(a.user.role));
  return <LoginForm next={(await searchParams).next} />;
}
