import type { Metadata } from "next";
import ResetForm from "@/components/auth/ResetForm";

export const metadata: Metadata = { title: "Atur kata sandi", robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <ResetForm token={(await params).token} />;
}
