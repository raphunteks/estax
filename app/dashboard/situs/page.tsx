import type { Metadata } from "next";
import SiteAdmin from "@/components/dash/SiteAdmin";

export const metadata: Metadata = { title: "Konten situs" };
export default function Page() {
  return <SiteAdmin />;
}
