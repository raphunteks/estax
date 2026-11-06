import type { Metadata } from "next";
import Account from "@/components/dash/Account";
import PortalProfile from "@/components/dash/PortalProfile";
import { getAuth } from "@/lib/auth/session";
import { twoFaRequired } from "@/lib/auth/users";

export const metadata: Metadata = { title: "Akun saya" };
export default async function Page() {
  const { user } = (await getAuth())!;
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Akun saya</h1>
      <div className="mb-5"><PortalProfile /></div>
      <Account id={user.id} photo={user.photo} name={user.name} email={user.email} role={user.role} totpEnabled={user.totpEnabled} mustChange={user.mustChangePassword} twoFaMandatory={await twoFaRequired(user.role)} />
    </div>
  );
}
