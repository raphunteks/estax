import type { Metadata } from "next";
import { StaffRecall } from "@/components/dash/StaffEngage";

export const metadata: Metadata = { title: "Kontrol & recall" };
export default function Page() { return <StaffRecall />; }
