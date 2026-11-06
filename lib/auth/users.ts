import bcrypt from "bcryptjs";
import { db } from "@/lib/db/store";
import { randomId } from "./crypto";
import { DEFAULT_2FA_REQUIRED, type Role } from "./rbac";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  subRole?: string;
  passHash: string;
  active: boolean;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  totpSecretEnc?: string;
  backupHashes: string[];
  lastTotpStep: number;
  photo?: string;
  /** undefined = verified (legacy/staff). Self-registered patients start as false until the email link is used. */
  emailVerified?: boolean;
  createdBy?: string;
  createdAt: number;
};
export type PublicUser = Omit<User, "passHash" | "totpSecretEnc" | "backupHashes">;

const uKey = (id: string) => `user:${id}`;
const eKey = (email: string) => `user:email:${email.trim().toLowerCase()}`;
const DUMMY = bcrypt.hashSync("dummy-password-for-timing", 10);

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export async function checkPassword(user: User | null, password: string) {
  const ok = await bcrypt.compare(password, user?.passHash ?? DUMMY);
  return Boolean(user) && ok;
}
export const toPublic = ({ passHash: _p, totpSecretEnc: _t, backupHashes: _b, ...rest }: User): PublicUser => rest;

export async function getUser(id: string): Promise<User | null> {
  return db().get<User>(uKey(id));
}
export async function findByEmail(email: string): Promise<User | null> {
  const id = await db().get<string>(eKey(email));
  return id ? getUser(id) : null;
}
export async function saveUser(u: User) {
  await db().set(uKey(u.id), u);
}
export async function listUsers(): Promise<User[]> {
  const ids = await db().smembers("users:all");
  return (await Promise.all(ids.map(getUser))).filter(Boolean) as User[];
}

export async function createUser(input: { email: string; name: string; role: Role; password: string; subRole?: string; createdBy?: string; mustChangePassword?: boolean; emailVerified?: boolean }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (await findByEmail(email)) throw new Error("email_taken");
  const u: User = {
    id: randomId(),
    email,
    name: input.name.trim(),
    role: input.role,
    subRole: input.subRole,
    passHash: await hashPassword(input.password),
    active: true,
    mustChangePassword: input.mustChangePassword ?? true,
    totpEnabled: false,
    backupHashes: [],
    lastTotpStep: 0,
    createdBy: input.createdBy,
    emailVerified: input.emailVerified,
    createdAt: Date.now(),
  };
  await saveUser(u);
  await db().set(eKey(email), u.id);
  await db().sadd("users:all", u.id);
  return u;
}

/** Per-role 2FA policy, editable by superadmin later. Stored in Redis, falls back to defaults. */
export async function twoFaRequired(role: Role): Promise<boolean> {
  const p = await db().get<Partial<Record<Role, boolean>>>("policy:2fa");
  return p?.[role] ?? DEFAULT_2FA_REQUIRED[role];
}

/** Password policy basics: length and not trivially equal to the email. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 10) return "Kata sandi minimal 10 karakter.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Gunakan kombinasi huruf dan angka.";
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) return "Kata sandi tidak boleh memuat nama email.";
  return null;
}

/** Safe projection for the team screens (no hashes, no secrets). */
export const teamView = (u: User) => ({ id: u.id, email: u.email, name: u.name, role: u.role, subRole: u.subRole, active: u.active, totpEnabled: u.totpEnabled, pendingInvite: u.mustChangePassword, createdAt: u.createdAt });
