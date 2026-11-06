/** Creates the initial superadmin accounts from env (never from source). Run: npm run seed */
import { createUser, findByEmail, passwordProblem } from "../lib/auth/users";

async function main() {
  let created = 0;
  for (const n of [1, 2, 3]) {
    const email = process.env[`SEED_SUPERADMIN_${n}_EMAIL`];
    const password = process.env[`SEED_SUPERADMIN_${n}_PASSWORD`];
    if (!email || !password) continue;
    if (await findByEmail(email)) {
      console.log(`skip (exists): ${email}`);
      continue;
    }
    const problem = passwordProblem(password, email);
    if (problem) {
      console.error(`skip ${email}: ${problem}`);
      continue;
    }
    await createUser({ email, name: process.env[`SEED_SUPERADMIN_${n}_NAME`] || "Superadmin", role: "superadmin", password, mustChangePassword: true });
    console.log(`created superadmin: ${email} (must change password + enable 2FA at first login)`);
    created++;
  }
  if (!created) console.log("nothing created. Set SEED_SUPERADMIN_1_EMAIL / _PASSWORD in .env.local");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
