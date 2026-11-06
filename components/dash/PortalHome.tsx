"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Skeleton, StatusBadge, api, fmtDate } from "./kit";

type Home = {
  patient: { name: string; rmNo: string | null; status: string } | null;
  next?: { date: string; time: string; doctorName: string; patientName?: string; status: string; queueNo: number | null } | null;
  arrivable?: { id: string; time: string } | null; queue?: { no: number | null; ahead: number; status: string } | null; promoCount?: number; family?: number;
  upcoming?: number; dueTotal?: number; unpaid?: number; visitCount?: number; lastVisit?: string | null;
  items: { id: string; t: number; title: string; body: string; url?: string }[];
};
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function PortalHome({ name }: { name: string }) {
  const [d, setD] = useState<Home | null>(null);
  const [arrMsg, setArrMsg] = useState("");
  const load = () => void api<Home>("/api/portal/ringkasan").then((r) => setD(r.ok ? (r as unknown as Home) : { patient: null, items: [] }));
  async function arrive(id: string) {
    const r = await api(`/api/appointments/${id}`, "PATCH", { action: "arrive" });
    setArrMsg(r.ok ? "Check-in berhasil. Nomor antrean Anda terbit." : (r.message ?? "Gagal check-in."));
    load();
  }
  useEffect(() => {
    const t = setTimeout(load, 0);
    const i = setInterval(() => document.visibilityState === "visible" && load(), 10000);
    return () => (clearTimeout(t), clearInterval(i));
  }, []);
  const tile = "glass rounded-2xl p-4 transition-transform active:scale-[0.98]";
  return (
    <div>
      <h1 className="display text-3xl">Halo, {name}</h1>
      {!d ? <div className="mt-6"><Skeleton /></div> : !d.patient ? <div className="mt-6"><Empty>Data pasien Anda belum tersedia. Hubungi klinik.</Empty></div> : (
        <div className="mt-5 space-y-4">
          <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div><p className="text-xs text-muted">No. Rekam Medis</p><p className="display text-2xl tabular-nums">{d.patient.rmNo ?? "Belum terbit"}</p></div>
            <Badge tone={d.patient.rmNo ? "ok" : "warn"}>{d.patient.rmNo ? "Terverifikasi" : "Menunggu verifikasi klinik"}</Badge>
          </div>
          {d.queue && (
            <section aria-label="Antrean hari ini" className="rounded-2xl border border-accent/40 bg-accent/10 p-5 text-center">
              <p className="text-xs tracking-widest text-muted uppercase">Antrean Anda</p>
              <p className="display text-6xl tabular-nums">{d.queue.no ?? "-"}</p>
              <p className="mt-1 font-medium" aria-live="polite">{d.queue.status === "dipanggil" ? "Giliran Anda. Silakan menuju ruang dokter." : d.queue.ahead === 0 ? "Anda berikutnya." : `${d.queue.ahead} pasien lagi sebelum Anda`}</p>
            </section>
          )}
          {d.arrivable && (
            <section className="glass rounded-2xl p-4">
              <p className="font-medium">Sudah sampai di klinik?</p>
              <p className="text-sm text-muted">Janji pukul {d.arrivable.time}. Check-in agar nomor antrean terbit.</p>
              <button className="btn btn-primary mt-3" onClick={() => void arrive(d.arrivable!.id)}>Saya sudah tiba</button>
              <p role="status" className="mt-2 min-h-5 text-sm text-muted">{arrMsg}</p>
            </section>
          )}
          <section aria-label="Layanan" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {([["/portal/persetujuan", "Persetujuan"], ["/portal/obat", "Obat"], ["/portal/edukasi", "Edukasi"], ["/portal/berkas", "Foto & rontgen"], ["/portal/keluarga", "Keluarga"], ["/portal/pesan", "Pesan"], ["/portal/survei", "Survei"], ["/portal/promo", "Promo"]] as const).map(([h, l]) => (
              <Link key={h} href={h} className="glass flex min-h-16 items-center justify-center rounded-2xl p-2 text-center text-sm transition-transform active:scale-[0.97]">{l}</Link>
            ))}
          </section>
          <section aria-label="Janji berikutnya" className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between"><h2 className="font-medium">Janji berikutnya</h2><Link href="/portal/janji" className="text-sm text-accent">Semua janji</Link></div>
            {d.next ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div><p className="display text-xl">{fmtDate(d.next.date)} · {d.next.time}</p><p className="text-sm text-muted">{d.next.doctorName}{d.next.patientName && d.next.patientName !== d.patient.name ? ` · ${d.next.patientName}` : ""}{d.next.queueNo ? ` · antrean ${d.next.queueNo}` : ""}</p></div>
                <StatusBadge s={d.next.status} />
              </div>
            ) : <p className="mt-2 text-sm text-muted">Belum ada janji. <Link href="/portal/janji" className="text-accent">Buat janji</Link></p>}
          </section>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/portal/tagihan" className={tile}><p className="text-xs text-muted">Tagihan belum lunas</p><p className="display mt-1 text-xl">{d.dueTotal ? rp(d.dueTotal) : "Lunas"}</p>{d.unpaid ? <p className="text-xs text-muted">{d.unpaid} tagihan</p> : null}</Link>
            <Link href="/portal/riwayat" className={tile}><p className="text-xs text-muted">Kunjungan selesai</p><p className="display mt-1 text-xl">{d.visitCount ?? 0}</p>{d.lastVisit ? <p className="text-xs text-muted">Terakhir {fmtDate(d.lastVisit)}</p> : null}</Link>
          </div>
          {(d.promoCount ?? 0) > 0 && <Link href="/portal/promo" className="glass flex items-center justify-between rounded-2xl p-4"><span><span className="font-medium">Promo untuk Anda</span><span className="block text-sm text-muted">{d.promoCount} promo sedang berlaku</span></span><span className="text-accent">Lihat</span></Link>}
          <section aria-label="Notifikasi" className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between"><h2 className="font-medium">Notifikasi terbaru</h2><Link href="/portal/akun" className="text-sm text-accent">Atur</Link></div>
            {d.items.length === 0 ? <p className="mt-2 text-sm text-muted">Belum ada notifikasi. Aktifkan notifikasi di Akun agar panggilan antrean sampai ke ponsel Anda.</p> : (
              <ul className="mt-2 divide-y divide-line">
                {d.items.map((n) => <li key={n.id} className="py-2 text-sm"><p className="font-medium">{n.title}</p><p className="text-muted">{n.body}</p><p className="text-xs text-muted">{new Date(n.t).toLocaleString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></li>)}
              </ul>
            )}
          </section>
          <Link href="/portal/tanya" className="block text-center text-sm text-accent">Pertanyaan umum</Link>
        </div>
      )}
    </div>
  );
}
