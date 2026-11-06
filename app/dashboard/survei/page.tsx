import type { Metadata } from "next";
import { StaffSurvey } from "@/components/dash/StaffEngage";

export const metadata: Metadata = { title: "Survei kepuasan" };
export default function Page() { return <StaffSurvey />; }
