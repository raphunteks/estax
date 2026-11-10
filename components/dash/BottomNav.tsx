"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, CalendarDays, ClipboardList, Ellipsis, House, LogOut, Package, Search, Stethoscope, UserCheck, Users, Wallet, ChartColumn, X, type LucideIcon } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap-lite";
import { peek, remember, sharedGet, useOnLive } from "@/lib/live";
import { api } from "./kit";

const MOBILE = "/api/dash/mobile";

type Item = { href: string; label: string; icon: string; soon: boolean; group: string };
type Data = {
  badges: Record<string, number>;
  primary: { kind: "exam"; apptId: string; patientName: string; queueNo: number | null; status: string; visitId: string | null } | { kind: "rx"; visitId: string; patientName: string; called: boolean } | null;
  checkin: { id: string; time: string; patientName: string; rmNo: string | null; doctorName: string; status: string }[];
};
type Slot = { href: string; label: string; Icon: LucideIcon };
type Center = { label: string; Icon: LucideIcon; kind: "exam" | "sheet-checkin" | "rx" | "sheet-search" };

/** Five slots per role. A slot is only rendered when the role can open it (its href is in the RBAC-filtered nav). */
const CONFIG: Record<string, { left: Slot[]; center: Center; right: Slot[] }> = {
  dokter: { left: [{ href: "/dashboard", label: "Beranda", Icon: House }, { href: "/dashboard/janji?tab=queue", label: "Antrian", Icon: CalendarDays }], center: { label: "Periksa", Icon: Stethoscope, kind: "exam" }, right: [{ href: "/dashboard/pasien", label: "Pasien", Icon: Users }] },
  staf: { left: [{ href: "/dashboard", label: "Beranda", Icon: House }, { href: "/dashboard/janji", label: "Janji", Icon: CalendarDays }], center: { label: "Check-in", Icon: UserCheck, kind: "sheet-checkin" }, right: [{ href: "/dashboard/kasir", label: "Kasir", Icon: Wallet }] },
  apoteker: { left: [{ href: "/dashboard", label: "Beranda", Icon: House }, { href: "/dashboard/farmasi?tab=rx", label: "Resep", Icon: ClipboardList }], center: { label: "Panggil", Icon: BellRing, kind: "rx" }, right: [{ href: "/dashboard/farmasi?tab=stock", label: "Stok", Icon: Package }] },
  superadmin: { left: [{ href: "/dashboard", label: "Beranda", Icon: House }, { href: "/dashboard/janji", label: "Janji", Icon: CalendarDays }], center: { label: "Cari pasien", Icon: Search, kind: "sheet-search" }, right: [{ href: "/dashboard/analitik", label: "Analitik", Icon: ChartColumn }] },
};
const base = (h: string) => h.split("?")[0];

/** Bottom sheet: slides on transform only, closes on Esc, backdrop tap or the close button. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.fromTo(ref.current, { yPercent: mm ? 0 : 8, opacity: 0 }, { yPercent: 0, opacity: 1, duration: mm ? 0 : 0.22, ease: "power3.out" });
  }, { scope: ref });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => (window.removeEventListener("keydown", k), prev?.focus?.());
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button aria-label="Tutup" className="absolute inset-0 bg-black/55" onClick={onClose} tabIndex={-1} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl lg:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4"><h2 className="display text-xl">{title}</h2><button onClick={onClose} aria-label="Tutup" className="grid size-10 place-items-center rounded-xl text-muted hover:text-fg"><X size={18} /></button></div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

function CheckinSheet({ rows, done }: { rows: Data["checkin"]; done: () => void }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const list = rows.filter((r) => !q || (r.patientName + (r.rmNo ?? "")).toLowerCase().includes(q.toLowerCase()));
  const go = async (id: string) => { const r = await api(`/api/appointments/${id}`, "PATCH", { action: "checkin" }); setMsg(r.ok ? "Pasien ditandai tiba. Nomor antrean terbit." : r.message ?? "Gagal."); done(); };
  return (
    <>
      <input aria-label="Cari nama atau No. RM" placeholder="Cari nama atau No. RM" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 min-h-11 w-full rounded-xl border border-line bg-transparent px-3 text-sm" />
      {list.length === 0 ? <p className="py-6 text-center text-sm text-muted">Tidak ada janji yang menunggu check-in hari ini.</p> : (
        <ul className="divide-y divide-line">{list.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="min-w-0"><p className="truncate font-medium">{r.patientName}</p><p className="truncate text-xs text-muted">{r.time} · {r.doctorName} · RM {r.rmNo ?? "-"}</p></div>
            <button className="btn btn-primary min-h-10 shrink-0" onClick={() => void go(r.id)}>Tandai tiba</button></li>))}</ul>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">{msg}</p>
    </>
  );
}

function SearchSheet({ close }: { close: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; name: string; rmNo: string | null; phone?: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => void api<{ patients: typeof rows }>(`/api/patients?q=${encodeURIComponent(q.trim())}`).then((r) => setRows(r.ok ? r.patients.slice(0, 20) : [])), 250);
    return () => clearTimeout(t);
  }, [q]);
  const shown = q.trim().length < 2 ? [] : rows;
  return (
    <>
      <input aria-label="Cari pasien" placeholder="Nama, No. RM, atau telepon" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 min-h-11 w-full rounded-xl border border-line bg-transparent px-3 text-sm" />
      {q.trim().length < 2 ? <p className="py-6 text-center text-sm text-muted">Ketik minimal 2 huruf.</p> : shown.length === 0 ? <p className="py-6 text-center text-sm text-muted">Tidak ditemukan.</p> : (
        <ul className="divide-y divide-line">{shown.map((p) => <li key={p.id}><Link href={`/dashboard/pasien/${p.id}`} onClick={close} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"><span className="truncate font-medium">{p.name}</span><span className="shrink-0 text-xs text-muted">RM {p.rmNo ?? "-"}</span></Link></li>)}</ul>
      )}
    </>
  );
}

export default function BottomNav({ role, locked, items, icons }: { role: string; locked: boolean; items: Item[]; icons: Record<string, LucideIcon> }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(() => peek<Data>(MOBILE));
  const [sheet, setSheet] = useState<"" | "more" | "checkin" | "search">("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const cfg = CONFIG[role];
  const allowed = useCallback((h: string) => items.some((i) => i.href === base(h)), [items]);
  const load = useCallback(() => void sharedGet(MOBILE, () => api<Data>(MOBILE)).then((r) => { if (r.ok) { remember(MOBILE, r); setData(r as unknown as Data); } }), []);
  useOnLive(load, 60000, !locked && !!cfg);
  const close = useCallback(() => setSheet(""), []);
  if (!cfg) return null;

  const tab = sp.get("tab");
  const isOn = (h: string) => { const [p, q] = h.split("?"); const t = q?.split("=")[1]; return (p === "/dashboard" ? path === p : path === p || path.startsWith(p + "/")) && (!t || t === tab); };
  const slots = [...cfg.left, ...cfg.right];
  const badge = (h: string) => data?.badges[h] ?? data?.badges[base(h)] ?? 0;
  const pr = data?.primary;
  const centerOk = cfg.center.kind === "exam" ? allowed("/dashboard/periksa") : cfg.center.kind === "rx" ? allowed("/dashboard/farmasi") : cfg.center.kind === "sheet-checkin" ? allowed("/dashboard/janji") : allowed("/dashboard/pasien");
  const centerDisabled = locked || !centerOk || busy || (cfg.center.kind === "rx" && pr?.kind !== "rx");
  const centerHint = cfg.center.kind === "exam" && pr?.kind !== "exam" ? "Belum ada pasien check-in, buka daftar pemeriksaan" : cfg.center.kind === "rx" && pr?.kind !== "rx" ? "Belum ada resep menunggu" : "";

  async function centerAction() {
    setNote("");
    if (cfg.center.kind === "sheet-checkin") return setSheet("checkin");
    if (cfg.center.kind === "sheet-search") return setSheet("search");
    if (cfg.center.kind === "exam" && pr?.kind !== "exam") return router.push("/dashboard/periksa");
    setBusy(true);
    try {
      if (pr?.kind === "exam") {
        let id = pr.visitId;
        if (!id) { const r = await api<{ id: string }>("/api/visits", "POST", { apptId: pr.apptId }); if (!r.ok) return setNote(r.message ?? "Gagal memulai pemeriksaan."); id = r.id; }
        router.push(`/dashboard/periksa/${id}`);
      } else if (pr?.kind === "rx") {
        const r = await api(`/api/pharmacy/rx/${pr.visitId}/call`, "POST");
        setNote(r.ok ? `Memanggil ${pr.patientName}.` : r.message ?? "Gagal memanggil.");
        load();
      }
    } finally { setBusy(false); }
  }
  const cls = (on: boolean, off?: boolean) => `relative flex min-h-14 flex-col items-center justify-end gap-0.5 pb-1.5 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-[0.95] ${on ? "text-accent" : "text-muted"} ${off ? "pointer-events-none opacity-40" : ""}`;
  const dot = (n: number) => (n > 0 ? <span className="absolute right-[calc(50%-20px)] top-1 grid min-w-4 place-items-center rounded-full bg-rose-700 px-1 text-[10px] font-semibold leading-4 text-white">{n > 99 ? "99+" : n}<span className="sr-only"> menunggu</span></span> : null);
  const slotEl = (s: Slot) => {
    const off = locked || !allowed(s.href);
    return (
      <li key={s.href}>
        <Link href={off ? "#" : s.href} onTouchStart={() => !off && router.prefetch(s.href)} aria-current={isOn(s.href) ? "page" : undefined} aria-disabled={off || undefined} className={cls(isOn(s.href), off)}>
          <s.Icon size={22} aria-hidden="true" /><span>{s.label}</span>{dot(badge(s.href))}
        </Link>
      </li>
    );
  };
  const moreItems = items.filter((i) => !slots.some((s) => base(s.href) === i.href) && i.href !== "/dashboard");
  const groups = [...new Set(moreItems.map((i) => i.group))];
  const moreBadge = moreItems.reduce((n, i) => n + (data?.badges[i.href] ?? 0), 0);

  return (
    <>
      <nav aria-label="Menu bawah" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <p role="status" className="sr-only">{note}</p>
        {note && <p aria-hidden="true" className="mx-auto max-w-lg truncate px-4 pt-1 text-center text-xs text-muted">{note}</p>}
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
          {cfg.left.map(slotEl)}
          <li>
            <button type="button" onClick={() => void centerAction()} disabled={centerDisabled} title={centerHint || undefined} aria-label={cfg.center.label + (centerHint ? `. ${centerHint}` : "")} className={`${cls(false)} w-full disabled:opacity-60`}>
              <span className={`-mt-6 grid size-14 place-items-center rounded-full shadow-lg shadow-accent/30 ${centerDisabled ? "bg-muted text-bg" : "bg-accent text-accent-ink"}`}><cfg.center.Icon size={24} aria-hidden="true" /></span>
              <span>{cfg.center.label}</span>
            </button>
          </li>
          {cfg.right.map(slotEl)}
          <li>
            <button type="button" onClick={() => setSheet("more")} aria-haspopup="dialog" className={cls(sheet === "more")}>
              <Ellipsis size={22} aria-hidden="true" /><span>Lainnya</span>{dot(moreBadge)}
            </button>
          </li>
        </ul>
      </nav>
      {sheet === "more" && (
        <Sheet title="Lainnya" onClose={close}>
          {groups.map((g) => (
            <div key={g} className="mb-3"><p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{g}</p>
              <ul className="grid grid-cols-2 gap-2">{moreItems.filter((i) => i.group === g).map((i) => { const I = icons[i.icon]; const off = locked && !i.href.endsWith("/akun"); const n = data?.badges[i.href] ?? 0; return (
                <li key={i.href}><Link href={off ? "#" : i.href} onClick={close} aria-disabled={off || undefined} className={`relative flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 text-sm transition-transform active:scale-[0.97] ${off ? "pointer-events-none opacity-40" : ""}`}>{I && <I size={18} className="shrink-0 text-accent" aria-hidden="true" />}<span className="truncate">{i.label}</span>{n > 0 && <span className="ml-auto rounded-full bg-[var(--bad)] px-1.5 text-[10px] font-semibold text-white">{n}</span>}</Link></li>); })}</ul></div>
          ))}
          <button className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm text-muted" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); window.location.assign("/masuk"); }}><LogOut size={16} aria-hidden="true" />Keluar</button>
        </Sheet>
      )}
      {sheet === "checkin" && <Sheet title="Check-in cepat" onClose={close}><CheckinSheet rows={data?.checkin ?? []} done={load} /></Sheet>}
      {sheet === "search" && <Sheet title="Cari pasien" onClose={close}><SearchSheet close={close} /></Sheet>}
    </>
  );
}
