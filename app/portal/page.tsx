import type { Metadata } from "next";
import PortalHome from "@/components/dash/PortalHome";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Portal Pasien",
  description: "Ringkasan jadwal kontrol, rekam medis gigi, dan tagihan Anda di Estaka Dental Clinic Makassar.",
};

export default async function Page() {
  const { user } = (await getAuth())!;
  return <PortalHome name={user.name.split(" ")[0]} userId={user.id} photo={user.photo} />;
}
