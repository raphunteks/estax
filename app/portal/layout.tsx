import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PushPrompt from "@/components/dash/PushPrompt";
import PortalNav, { PortalTabBar } from "@/components/dash/PortalNav";
import { getAuth } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/rbac";
import { twoFaRequired } from "@/lib/auth/users";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: { default: "Portal Pasien", template: "%s · Estaka Dental Clinic" },
  description: "Portal pasien resmi Estaka Dental Clinic Makassar untuk jadwal janji temu, rekam medis gigi, dan tagihan.",
};
export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const a = await getAuth();
  if (!a) redirect("/masuk");
  if (a.user.role !== "pasien") redirect(homeFor(a.user.role));
  const locked = a.user.mustChangePassword || ((await twoFaRequired("pasien")) && !a.user.totpEnabled);
  const path = (await headers()).get("x-pathname") ?? "/portal";
  if (locked && path !== "/portal/akun") redirect("/portal/akun");
  return (
    <>
      <PortalNav locked={locked} />
      {!locked && <PushPrompt uid={a.user.id} />}
      <main id="main" className="mx-auto w-full max-w-4xl px-4 py-8 pb-32 md:pb-8">{children}</main>
      <PortalTabBar locked={locked} />
    </>
  );
}
