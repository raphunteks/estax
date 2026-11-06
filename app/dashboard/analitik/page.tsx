import type { Metadata } from "next";
import Analytics from "@/components/dash/Analytics";

export const metadata: Metadata = { title: "Analitik" };
export default function Page() {
  return <Analytics />;
}
