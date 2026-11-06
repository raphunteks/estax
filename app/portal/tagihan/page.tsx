import type { Metadata } from "next";
import PortalBills from "@/components/dash/PortalBills";

export const metadata: Metadata = { title: "Tagihan" };
export default function Page() {
  return <PortalBills />;
}
