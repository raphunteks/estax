import Link from "next/link";
import { getAuth } from "@/lib/auth/session";
import { getStats } from "@/lib/clinic/stats";
import Charts from "@/components/dash/Charts";
import { navFor } from "@/lib/routes";
import LiveClock from "@/components/dash/LiveClock";
import RoleKpi from "@/components/dash/RoleKpi";

export default async function Page() {
  const { user } = (await getAuth())!;
  const h = (new Date().getUTCHours() + 8) % 24;
  const greet = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  const s = await getStats(user);
  const ROLE = {
    dokter: { label: "Dokter Gigi", sub: "Pantau antrean, mulai pemeriksaan, dan tinjau rekam medis pasien Anda." },
    staf: { label: "Staf/Perawat", sub: "Kelola janji, check-in pasien, dan kasir dengan lancar." },
    apoteker: { label: "Apoteker/Farmasi", sub: "Siapkan resep, panggil pasien, dan jaga ketersediaan stok obat." },
    superadmin: { label: "Superadmin", sub: "Pantau operasional, tim, dan kinerja layanan klinik dalam satu layar." },
  } as Record<string, { label: string; sub: string }>;
  const r = ROLE[user.role] ?? { label: user.role, sub: "Ringkasan layanan klinik hari ini." };
  const shown = user.role === "dokter" && !/^(drg?\.?)\s/i.test(user.name) ? `drg. ${user.name}` : user.name;
  return (
    <div>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <LiveClock className="text-sm text-muted" />
          <p className="mt-1 text-lg text-muted">{greet},</p>
          <h1 className="display break-words text-3xl leading-tight sm:text-4xl">{shown}</h1>
          <span className="mt-2 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-0.5 text-xs font-medium text-accent">{r.label}</span>
          <p className="mt-3 max-w-xl text-sm text-muted">{r.sub}</p>
        </div>
        <Link href="/dashboard/akun" aria-label="Akun saya" className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-accent/15 text-xl font-semibold text-accent transition-transform active:scale-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {user.photo ? <img src={`/api/files/avatar/${user.id}?v=${user.photo}`} alt="" width={64} height={64} className="size-16 object-cover" /> : user.name.slice(0, 1).toUpperCase()}
        </Link>
      </header>
      <RoleKpi quick={navFor(user.role).filter((n) => !["/dashboard", "/dashboard/akun"].includes(n.href)).map((n) => ({ href: n.href, label: n.label.id, icon: n.icon }))} />
      {s.limited ? (
        <div className="glass inline-block rounded-2xl p-5"><p className="text-xs text-muted">Pasien terjadwal hari ini</p><p className="display mt-1 text-3xl">{s.today}</p></div>
      ) : (
        <Charts s={s} />
      )}
    </div>
  );
}
