import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QueueMonitor from "@/components/monitor/QueueMonitor";
import { getAuth } from "@/lib/auth/session";
import { MONITOR_ROLES } from "@/lib/clinic/monitor";

export const metadata: Metadata = { title: "Monitor antrean poliklinik", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const a = await getAuth();
  if (!a) redirect("/masuk?next=/monitor-antrean-poliklinik");
  if (!MONITOR_ROLES.includes(a.user.role)) redirect("/tidak-berwenang");
  return <QueueMonitor kind="poli" />;
}
