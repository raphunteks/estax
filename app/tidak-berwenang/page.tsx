import Link from "next/link";
import { AuthShell } from "@/components/auth/ui";

export default function Page() {
  return (
    <AuthShell title="Akses ditolak" sub="Peran Anda tidak memiliki izin untuk membuka halaman ini.">
      <Link href="/masuk" className="btn btn-primary w-full">
        Kembali
      </Link>
    </AuthShell>
  );
}
