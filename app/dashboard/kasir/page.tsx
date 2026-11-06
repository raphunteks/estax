import type { Metadata } from "next";
import Billing from "@/components/dash/Billing";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Kasir" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return <Billing role={user.role as "superadmin" | "dokter" | "staf" | "apoteker"} />;
}
