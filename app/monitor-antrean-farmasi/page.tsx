import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QueueMonitor from "@/components/monitor/QueueMonitor";
import { getAuth } from "@/lib/auth/session";
import { MONITOR_ROLES } from "@/lib/clinic/monitor";

export const metadata: Metadata = {
  title: "Monitor Antrean Farmasi",
  description: "Layar monitor antrean pengambilan obat dan farmasi Estaka Dental Clinic Makassar.",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  const a = await getAuth();
  if (!a) redirect("/masuk?next=/monitor-antrean-farmasi");
  if (!MONITOR_ROLES.includes(a.user.role)) redirect("/tidak-berwenang");
  return <QueueMonitor kind="farmasi" />;
}
