import type { Metadata } from "next";
import Team from "@/components/dash/Team";
import { getAuth } from "@/lib/auth/session";
import { PERMISSIONS, ROLES, can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Tim & Akses" };

export default async function Page() {
  const { user } = (await getAuth())!;
  const perms = [...new Set(Object.values(PERMISSIONS).flat())].filter((p) => p !== "*").sort();
  const allowed = Object.fromEntries(ROLES.map((r) => [r, perms.map((p) => can(r, p))]));
  return <Team matrix={{ perms, roles: [...ROLES], allowed }} isSuper={user.role === "superadmin"} />;
}
