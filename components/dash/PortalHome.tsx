"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Skeleton, StatusBadge, api, fmtDate } from "./kit";

type Home = {
  patient: { name: string; rmNo: string | null; status: string } | null;
  next?: { date: string; time: string; doctorName: string; status: string; queueNo: number | null } | null;
  upcoming?: number; dueTotal?: number; unpaid?: number; visitCount?: number; lastVisit?: string | null;
  items: { id: string; t: number; title: string; body: string; url?: string }[];
};
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function PortalHome({ name }: { name: string }) {
  const [d, setD] = useState<Home | null>(null);
  useEffect(() => {
    const load = () => void api<Home>("/api/portal/ringkasan").then((r) => setD(r.ok ? (r as unknown as Home) : { patient: null, items: [] }));
    const t = setTimeout(load, 0);
    const i = setInterval(() => document.visibilityState === "visible" && load(), 20000);
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
          <section aria-label="Janji berikutnya" className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between"><h2 className="font-medium">Janji berikutnya</h2><Link href="/portal/janji" className="text-sm text-accent">Semua janji</Link></div>
            {d.next ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div><p className="display text-xl">{fmtDate(d.next.date)} · {d.next.time}</p><p className="text-sm text-muted">{d.next.doctorName}{d.next.queueNo ? ` · antrean ${d.next.queueNo}` : ""}</p></div>
                <StatusBadge s={d.next.status} />
              </div>
            ) : <p className="mt-2 text-sm text-muted">Belum ada janji. <Link href="/portal/janji" className="text-accent">Buat janji</Link></p>}
          </section>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/portal/tagihan" className={tile}><p className="text-xs text-muted">Tagihan belum lunas</p><p className="display mt-1 text-xl">{d.dueTotal ? rp(d.dueTotal) : "Lunas"}</p>{d.unpaid ? <p className="text-xs text-muted">{d.unpaid} tagihan</p> : null}</Link>
            <Link href="/portal/riwayat" className={tile}><p className="text-xs text-muted">Kunjungan selesai</p><p className="display mt-1 text-xl">{d.visitCount ?? 0}</p>{d.lastVisit ? <p className="text-xs text-muted">Terakhir {fmtDate(d.lastVisit)}</p> : null}</Link>
          </div>
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
