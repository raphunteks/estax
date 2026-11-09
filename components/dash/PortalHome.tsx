"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LiveClock from "./LiveClock";
import { Badge, Empty, Skeleton, StatusBadge, api, fmtDate } from "./kit";
import { Bell, CalendarCheck, ChevronRight, ClipboardSignature, FileImage, Gift, MessageCircle, Phone, Pill, Receipt, Sparkles, Star, Stethoscope, Users, BookOpen, type LucideIcon } from "lucide-react";

type Home = {
  patient: { name: string; rmNo: string | null; status: string } | null;
  next?: { date: string; time: string; doctorName: string; patientName?: string; status: string; queueNo: number | null } | null;
  arrivable?: { id: string; time: string } | null; queue?: { no: number | null; ahead: number; status: string } | null; promoCount?: number; family?: number;
  upcoming?: number; dueTotal?: number; unpaid?: number; visitCount?: number; lastVisit?: string | null;
  pending?: { consent: number; survey: number };
  items: { id: string; t: number; title: string; body: string; url?: string }[];
};
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const TINT = { rose: "#f43f5e", sky: "#38bdf8", amber: "#f59e0b", green: "#10b981", violet: "#8b5cf6", teal: "#14b8a6" } as const;
const tint = (c: keyof typeof TINT) => ({ "--t": TINT[c], background: "color-mix(in oklab, var(--t) 13%, transparent)", borderColor: "color-mix(in oklab, var(--t) 28%, transparent)" }) as React.CSSProperties;
function Kpi({ href, icon: I, c, value, label }: { href: string; icon: LucideIcon; c: keyof typeof TINT; value: string | number; label: string }) {
  return (
    <Link href={href} style={tint(c)} className="flex flex-col items-center rounded-2xl border px-1 py-3 text-center transition-transform active:scale-[0.97]">
      <I size={20} aria-hidden="true" style={{ color: "var(--t)" }} />
      <span className="display mt-1 text-xl leading-none tabular-nums">{value}</span>
      <span className="mt-1 text-[11px] leading-tight text-muted">{label}</span>
    </Link>
  );
}
function Action({ href, icon: I, c, label, badge }: { href: string; icon: LucideIcon; c: keyof typeof TINT; label: string; badge?: number }) {
  return (
    <Link href={href} style={tint(c)} className="group relative flex min-h-24 flex-col justify-between rounded-2xl border p-3 transition-transform active:scale-[0.97]">
      <I size={24} aria-hidden="true" style={{ color: "var(--t)" }} />
      <span className="flex items-end justify-between gap-1 text-sm font-medium leading-tight">{label}<ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" /></span>
      {badge ? <span className="absolute right-2 top-2 grid min-w-5 place-items-center rounded-full bg-[var(--bad)] px-1 text-[11px] font-semibold text-white" aria-label={`${badge} menunggu`}>{badge}</span> : null}
    </Link>
  );
}

export default function PortalHome({ name, userId, photo }: { name: string; userId: string; photo?: string }) {
  const [d, setD] = useState<Home | null>(() => (api.getCache<Home>("/api/portal/ringkasan") as unknown as Home) ?? null);
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
  return (
    <div>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <LiveClock className="text-sm text-muted" />
          <h1 className="display truncate text-3xl">Halo, {name}</h1>
          <p className="text-sm text-muted">Ringkasan layanan Anda hari ini.</p>
        </div>
        <Link href="/portal/akun" aria-label="Akun saya" className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-accent/15 text-xl font-semibold text-accent transition-transform active:scale-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={`/api/files/avatar/${userId}?v=${photo}`} alt="" width={64} height={64} className="size-16 object-cover" /> : name.slice(0, 1).toUpperCase()}
        </Link>
      </header>
      {!d ? <div className="mt-6"><Skeleton /></div> : !d.patient ? <div className="mt-6"><Empty>Data pasien Anda belum tersedia. Hubungi klinik.</Empty></div> : (
        <div className="mt-5 space-y-4">
          <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div><p className="text-xs text-muted">No. Rekam Medis</p><p className="display text-2xl tabular-nums">{d.patient.rmNo ?? "Belum terbit"}</p></div>
            <Badge tone={d.patient.rmNo ? "ok" : "warn"}>{d.patient.rmNo ? "Terverifikasi" : "Menunggu verifikasi klinik"}</Badge>
          </div>
          <section aria-label="Ringkasan" className="grid grid-cols-4 gap-2">
            <Kpi href="/portal/janji" icon={CalendarCheck} c="rose" value={d.upcoming ?? 0} label="Janji aktif" />
            <Kpi href="/portal/riwayat" icon={Stethoscope} c="sky" value={d.visitCount ?? 0} label="Kunjungan" />
            <Kpi href="/portal/tagihan" icon={Receipt} c="amber" value={d.unpaid ?? 0} label="Tagihan" />
            <Kpi href="/portal/promo" icon={Gift} c="green" value={d.promoCount ?? 0} label="Promo" />
          </section>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link href="/portal/tanya" aria-label="Tanya Asisten Estaka" style={tint("violet")} className="flex items-center gap-3 rounded-2xl border p-4 transition-transform active:scale-[0.98]">
              <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--t) 22%, transparent)" }}><Sparkles size={22} aria-hidden="true" style={{ color: "var(--t)" }} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Tanya Teks AI</span><span className="block text-xs text-muted">Layanan, jadwal, biaya</span></span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
            </Link>
            <Link href="/portal/bicara" aria-label="Telepon Suara AI" style={tint("teal")} className="flex items-center gap-3 rounded-2xl border p-4 transition-transform active:scale-[0.98]">
              <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--t) 22%, transparent)" }}><Phone size={22} aria-hidden="true" style={{ color: "var(--t)" }} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Telepon Suara AI</span><span className="block text-xs text-muted">Bicara langsung dua arah</span></span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </div>
          <section aria-label="Layanan">
            <h2 className="mb-2 font-medium">Layanan cepat</h2>
            <div className="grid grid-cols-3 gap-2">
              <Action href="/portal/janji" icon={CalendarCheck} c="rose" label="Buat janji" />
              <Action href="/portal/persetujuan" icon={ClipboardSignature} c="sky" label="Persetujuan" badge={d.pending?.consent} />
              <Action href="/portal/obat" icon={Pill} c="green" label="Obat" />
              <Action href="/portal/edukasi" icon={BookOpen} c="amber" label="Edukasi" />
              <Action href="/portal/berkas" icon={FileImage} c="violet" label="Foto & rontgen" />
              <Action href="/portal/keluarga" icon={Users} c="teal" label="Keluarga" badge={undefined} />
              <Action href="/portal/pesan" icon={MessageCircle} c="sky" label="Pesan" />
              <Action href="/portal/survei" icon={Star} c="amber" label="Survei" badge={d.pending?.survey} />
              <Action href="/portal/akun" icon={Bell} c="rose" label="Notifikasi" />
            </div>
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
