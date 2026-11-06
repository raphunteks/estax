import type { Metadata } from "next";
import VoiceCall from "@/components/dash/VoiceCall";

export const metadata: Metadata = { title: "Telepon AI · Estaka" };

export default function Page() {
  return <VoiceCall />;
}

