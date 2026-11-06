import type { Metadata } from "next";
import Settings from "@/components/dash/Settings";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Pengaturan" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return <Settings canEdit={user.role === "superadmin"} />;
}
