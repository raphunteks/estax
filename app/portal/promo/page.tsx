import type { Metadata } from "next";
import PortalPromo from "@/components/dash/PortalPromo";

export const metadata: Metadata = { title: "Promo" };
export default function Page() { return <PortalPromo />; }
