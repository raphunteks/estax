import type { Metadata } from "next";
import VerifyEmail from "@/components/auth/VerifyEmail";

export const metadata: Metadata = { title: "Verifikasi email", robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <VerifyEmail token={(await params).token} />;
}
