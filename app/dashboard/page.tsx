import { getAuth } from "@/lib/auth/session";
import { getStats } from "@/lib/clinic/stats";
import Charts from "@/components/dash/Charts";
import { navFor } from "@/lib/routes";
import RoleKpi from "@/components/dash/RoleKpi";

export default async function Page() {
  const { user } = (await getAuth())!;
  const h = (new Date().getUTCHours() + 8) % 24;
  const greet = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  const s = await getStats(user);
  return (
    <div>
      <h1 className="display text-3xl sm:text-4xl">{greet}, {user.name.split(" ")[0]}</h1>
      <p className="mb-6 mt-2 text-muted">Ringkasan klinik dari data nyata.</p>
      <RoleKpi quick={navFor(user.role).filter((n) => !["/dashboard", "/dashboard/akun"].includes(n.href)).map((n) => ({ href: n.href, label: n.label.id, icon: n.icon }))} />
      {s.limited ? (
        <div className="glass inline-block rounded-2xl p-5"><p className="text-xs text-muted">Pasien terjadwal hari ini</p><p className="display mt-1 text-3xl">{s.today}</p></div>
      ) : (
        <Charts s={s} />
      )}
    </div>
  );
}
