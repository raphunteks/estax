import type { Metadata } from "next";
import Pharmacy from "@/components/dash/Pharmacy";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Farmasi & Stok" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return <Pharmacy role={user.role as "superadmin" | "dokter" | "staf" | "apoteker"} />;
}
