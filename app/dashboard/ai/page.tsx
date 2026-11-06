import type { Metadata } from "next";
import AiAssistant from "@/components/dash/AiAssistant";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Asisten AI" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return <AiAssistant role={user.role} />;
}
