import type { Metadata } from "next";
import PortalServices from "@/components/dash/PortalServices";

export const metadata: Metadata = { title: "Keluarga" };
export default function Page() { return <PortalServices kind="keluarga" />; }
