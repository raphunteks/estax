import type { Metadata } from "next";
import PortalHistory from "@/components/dash/PortalHistory";

export const metadata: Metadata = { title: "Riwayat perawatan" };
export default function Page() {
  return <PortalHistory />;
}
