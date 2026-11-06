import type { Metadata } from "next";
import PortalHome from "@/components/dash/PortalHome";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Portal pasien", robots: { index: false } };

export default async function Page() {
  const { user } = (await getAuth())!;
  return <PortalHome name={user.name.split(" ")[0]} userId={user.id} photo={user.photo} />;
}
