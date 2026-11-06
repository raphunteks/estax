import { can, type Role } from "@/lib/auth/rbac";

/** One source of truth: sidebar, route guard and tests all read this table. `phase` > 2 renders as "segera hadir". */
export type NavItem = { href: string; perm: string; label: { id: string; en: string }; icon: string; phase: number; group: string };

export const NAV: NavItem[] = [
  { href: "/dashboard", perm: "dashboard:view", label: { id: "Beranda", en: "Home" }, icon: "home", phase: 0, group: "Utama" },
  { href: "/dashboard/pasien", perm: "patients:read", label: { id: "Pasien", en: "Patients" }, icon: "users", phase: 2, group: "Klinis" },
  { href: "/dashboard/janji", perm: "appointments:read", label: { id: "Janji & Antrian", en: "Appointments" }, icon: "calendar", phase: 2, group: "Klinis" },
  { href: "/dashboard/periksa", perm: "exam:read-basic", label: { id: "Pemeriksaan", en: "Examination" }, icon: "tooth", phase: 3, group: "Klinis" },
  { href: "/dashboard/kasir", perm: "billing:read", label: { id: "Kasir", en: "Billing" }, icon: "wallet", phase: 4, group: "Operasional" },
  { href: "/dashboard/farmasi", perm: "pharmacy:read", label: { id: "Farmasi & Stok", en: "Pharmacy" }, icon: "pill", phase: 4, group: "Operasional" },
  { href: "/dashboard/analitik", perm: "dashboard:view", label: { id: "Analitik", en: "Analytics" }, icon: "chart", phase: 5, group: "Operasional" },
  { href: "/dashboard/ai", perm: "dashboard:view", label: { id: "Asisten AI", en: "AI assistant" }, icon: "spark", phase: 6, group: "Operasional" },
  { href: "/dashboard/tim", perm: "users:read", label: { id: "Tim & Akses", en: "Team & access" }, icon: "shield", phase: 1, group: "Admin" },
  { href: "/dashboard/situs", perm: "site:manage", label: { id: "Konten Situs", en: "Site content" }, icon: "globe", phase: 2, group: "Admin" },
  { href: "/dashboard/pengaturan", perm: "settings:read", label: { id: "Pengaturan", en: "Settings" }, icon: "cog", phase: 1, group: "Admin" },
  { href: "/dashboard/audit", perm: "audit:self", label: { id: "Log Audit", en: "Audit log" }, icon: "log", phase: 0, group: "Admin" },
  { href: "/dashboard/akun", perm: "account:self", label: { id: "Akun saya", en: "My account" }, icon: "user", phase: 0, group: "Akun" },
];

export const navFor = (role: Role) => NAV.filter((n) => can(role, n.perm));

/** Longest-prefix match against the table. Unknown dashboard paths are denied. */
export function canAccessPath(role: Role, path: string): boolean {
  const hit = NAV.filter((n) => path === n.href || path.startsWith(n.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return hit ? can(role, hit.perm) : false;
}
