import type { Metadata } from "next";
import { StaffChat } from "@/components/dash/StaffEngage";

export const metadata: Metadata = { title: "Pesan pasien" };
export default function Page() { return <StaffChat />; }
