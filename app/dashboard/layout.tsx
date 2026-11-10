import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import LiveSync from "@/components/dash/LiveSync";
import PushPrompt from "@/components/dash/PushPrompt";
import Shell from "@/components/dash/Shell";
import { getAuth } from "@/lib/auth/session";
import { twoFaRequired } from "@/lib/auth/users";
import { canAccessPath, navFor } from "@/lib/routes";

export const metadata: Metadata = {
  title: { default: "Dashboard Klinik", template: "%s · Estaka Dental Clinic" },
  description: "Sistem informasi manajemen klinik gigi terpadu Estaka Dental Clinic Makassar.",
};
export const dynamic = "force-dynamic";
const LIVE = ["/dashboard", "/dashboard/akun", "/dashboard/audit", "/dashboard/tim", "/dashboard/pengaturan", "/dashboard/pasien", "/dashboard/janji", "/dashboard/periksa", "/dashboard/situs", "/dashboard/kasir", "/dashboard/farmasi", "/dashboard/analitik", "/dashboard/ai", "/dashboard/promosi", "/dashboard/pesan", "/dashboard/survei", "/dashboard/recall"];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const a = await getAuth();
  if (!a) redirect("/masuk");
  const { user } = a;
  if (user.role === "pasien") redirect("/portal");

  const path = (await headers()).get("x-pathname") ?? "/dashboard";
  // First-login gate: forced password change and mandatory 2FA must be done before anything else.
  const locked = user.mustChangePassword || (!user.totpEnabled && (await twoFaRequired(user.role)));
  if (locked && path !== "/dashboard/akun") redirect("/dashboard/akun");
  if (!canAccessPath(user.role, path)) redirect("/tidak-berwenang");

  const items = navFor(user.role).map((n) => ({ href: n.href, label: n.label.id, icon: n.icon, soon: !LIVE.includes(n.href), group: n.group }));
  return (
    <Shell items={items} user={{ id: user.id, photo: user.photo, name: user.name, role: user.role, email: user.email }} locked={locked}>
      {!locked && <PushPrompt uid={user.id} />}
      {!locked && <LiveSync />}
      {children}
    </Shell>
  );
}
