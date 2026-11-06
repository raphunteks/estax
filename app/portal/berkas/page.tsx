import type { Metadata } from "next";
import PortalServices from "@/components/dash/PortalServices";

export const metadata: Metadata = { title: "Foto & rontgen" };
export default function Page() { return <PortalServices kind="berkas" />; }
