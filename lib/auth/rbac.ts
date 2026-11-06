export const ROLES = ["superadmin", "dokter", "staf", "apoteker", "pasien"] as const;
export type Role = (typeof ROLES)[number];

/** Permission = "module:action". "*" = everything, "module:*" = all actions of a module. */
export const PERMISSIONS: Record<Role, string[]> = {
  superadmin: ["*"],
  dokter: ["dashboard:view", "account:self", "patients:read", "patients:update", "appointments:*", "exam:*", "users:invite-staff", "users:read", "analytics:own", "ai:use", "billing:read", "pharmacy:read", "audit:self", "settings:read", "promo:manage", "survey:read", "chat:staff", "recall:manage"],
  staf: ["dashboard:view", "account:self", "patients:create", "patients:read", "patients:update", "patients:verify", "appointments:*", "exam:read-basic", "billing:*", "pharmacy:read", "pharmacy:stock-supplies", "analytics:ops", "ai:limited", "chat:staff", "recall:manage", "promo:read"],
  apoteker: ["dashboard:view", "account:self", "pharmacy:*", "billing:read", "analytics:pharmacy", "ai:limited"],
  pasien: ["portal:view", "account:self", "appointments:own", "records:own", "billing:own", "files:own", "privacy:own", "promo:own", "consent:own", "family:own", "chat:own", "survey:own"],
};

export function can(role: Role, perm: string): boolean {
  const list = PERMISSIONS[role] ?? [];
  const [mod] = perm.split(":");
  return list.includes("*") || list.includes(perm) || list.includes(`${mod}:*`);
}

/** Roles whose accounts each role may create. Doctors cannot create doctors or superadmins. */
export const CAN_CREATE: Record<Role, Role[]> = {
  superadmin: ["superadmin", "dokter", "staf", "apoteker", "pasien"],
  dokter: ["staf", "apoteker"],
  staf: ["pasien"],
  apoteker: [],
  pasien: [],
};

export const homeFor = (role: Role) => (role === "pasien" ? "/portal" : "/dashboard");
export const DEFAULT_2FA_REQUIRED: Record<Role, boolean> = { superadmin: true, dokter: true, staf: false, apoteker: false, pasien: false };
export const accountFor = (role: Role) => (role === "pasien" ? "/portal/akun" : "/dashboard/akun");
