import type { Metadata } from "next";
import PortalServices from "@/components/dash/PortalServices";

export const metadata: Metadata = { title: "Obat & jadwal minum" };
export default function Page() { return <PortalServices kind="obat" />; }
