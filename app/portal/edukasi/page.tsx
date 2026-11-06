import type { Metadata } from "next";
import PortalServices from "@/components/dash/PortalServices";

export const metadata: Metadata = { title: "Edukasi perawatan" };
export default function Page() { return <PortalServices kind="edukasi" />; }
