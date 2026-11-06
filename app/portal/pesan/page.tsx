import type { Metadata } from "next";
import PortalServices from "@/components/dash/PortalServices";

export const metadata: Metadata = { title: "Pesan ke klinik" };
export default function Page() { return <PortalServices kind="pesan" />; }
