/** DEV ONLY. Creates one active, fully set-up account per role in the dev store so the API/E2E tests can log in. */
import { createUser, findByEmail, saveUser } from "../lib/auth/users";
import { encrypt } from "../lib/auth/crypto";

if (process.env.NODE_ENV === "production") throw new Error("refusing to run in production");
const FIXTURE_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const PASSWORD = process.env.FIXTURE_PASSWORD ?? "";
if (!PASSWORD) throw new Error("set FIXTURE_PASSWORD");

const rows = [
  ["sa@t.test", "Super Test", "superadmin", undefined],
  ["dr@t.test", "Dokter Test", "dokter", undefined],
  ["st@t.test", "Staf Test", "staf", "perawat"],
  ["ap@t.test", "Apoteker Test", "apoteker", undefined],
  ["pa@t.test", "Pasien Test", "pasien", undefined],
] as const;

async function main() {
for (const [email, name, role, subRole] of rows) {
  if (await findByEmail(email)) continue;
  const u = await createUser({ email, name, role, subRole, password: PASSWORD, mustChangePassword: false });
  if (role === "superadmin" || role === "dokter") {
    u.totpEnabled = true;
    u.totpSecretEnc = encrypt(FIXTURE_SECRET);
    await saveUser(u);
  }
}
console.log("fixtures ready");
}
void main();
