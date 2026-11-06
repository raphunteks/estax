"use client";

import ThemeMenu from "@/components/ThemeMenu";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, ChevronDown, Cog, Globe, Home, Lock, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ScrollText, ShieldCheck, Sparkles, Stethoscope, User, Users, Wallet, Pill, BarChart3, X, type LucideIcon } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import Logo from "@/components/Logo";

const ICONS: Record<string, LucideIcon> = { home: Home, users: Users, calendar: CalendarDays, tooth: Stethoscope, wallet: Wallet, pill: Pill, chart: BarChart3, spark: Sparkles, shield: ShieldCheck, cog: Cog, log: ScrollText, globe: Globe, user: User };
export type SideItem = { href: string; label: string; icon: string; soon: boolean; group: string };

const listeners = new Set<() => void>();
const sub = (cb: () => void) => (listeners.add(cb), () => void listeners.delete(cb));
const read = (k: string) => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
  listeners.forEach((l) => l());
};

export default function Shell({ items, user, locked, children }: { items: SideItem[]; user: { id: string; name: string; role: string; email: string; photo?: string }; locked: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const rail = useSyncExternalStore(sub, () => read("rail") === "1", () => false);
  const openRaw = useSyncExternalStore(sub, () => read("navopen"), () => "");
  const openMap = (() => { try { return JSON.parse(openRaw || "{}") as Record<string, boolean>; } catch { return {}; } })();

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Lock body scroll on mobile/tablet when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const toggleRail = () => write("rail", rail ? "0" : "1");
  const isActive = (h: string) => (h === "/dashboard" ? path === h : path === h || path.startsWith(h + "/"));
  const toggleGroup = (g: string, cur: boolean) => write("navopen", JSON.stringify({ ...openMap, [g]: !cur }));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/masuk");
  }

  const groups = [...new Set(items.map((i) => i.group))];
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-dvh lg:flex">
      {open && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        aria-label="Navigasi dashboard"
        className={`dash-aside fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 ease-out ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:shadow-none lg:transition-[width] ${
          rail ? "lg:w-[72px]" : "lg:w-64"
        }`}
      >
        <div className={`flex items-center px-3 ${rail ? "flex-col gap-3 py-3" : "h-[72px] justify-between"}`}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 text-accent" aria-label="Beranda dashboard">
            <Logo size={rail ? 36 : 40} className="shrink-0" />
            {!rail && (
              <span className="min-w-0 leading-tight">
                <span className="display block text-xl tracking-[0.06em] text-fg">Estaka</span>
                <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-muted">Dental Clinic</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={toggleRail} className="hidden size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition-[color,transform] hover:text-fg active:scale-95 lg:grid" aria-label={rail ? "Lebarkan sidebar" : "Ciutkan sidebar"} aria-expanded={!rail}>
            {rail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="rounded-lg p-2 text-muted hover:text-fg lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menu utama">
          {groups.map((g, gi) => {
            const list = items.filter((i) => i.group === g);
            const hasActive = list.some((i) => isActive(i.href));
            const expanded = rail ? true : (openMap[g] ?? hasActive);
            const gid = `nav-${g.toLowerCase()}`;
            return (
              <div key={g} className={rail ? (gi ? "mt-3 border-t border-line pt-3" : "") : "mt-1"}>
                {!rail && (
                  <button type="button" onClick={() => toggleGroup(g, expanded)} aria-expanded={expanded} aria-controls={gid} className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-xs font-medium uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg">
                    {g}
                    <ChevronDown size={16} className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
                  </button>
                )}
                <div id={gid} hidden={!expanded} className="space-y-0.5 pb-1">
                  {list.map((i) => {
                    const Icon = ICONS[i.icon] ?? Activity;
                    const active = isActive(i.href);
                    const gated = locked && !i.href.endsWith("/akun");
                    const base = `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${rail ? "justify-center" : ""}`;
                    return (
                      <Link
                        key={i.href}
                        href={gated ? "/dashboard/akun" : i.href}
                        onClick={() => setOpen(false)}
                        title={gated ? "Selesaikan langkah keamanan di Akun saya dulu" : rail ? i.label : undefined}
                        aria-label={rail ? i.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`${base} ${active ? "bg-accent text-accent-ink" : gated ? "text-muted opacity-60 hover:opacity-100" : "text-muted hover:bg-fg/5 hover:text-fg"}`}
                      >
                        <Icon size={18} className="shrink-0" aria-hidden="true" />
                        {!rail && <span className="truncate">{i.label}</span>}
                        {!rail && gated && <Lock size={13} className="ml-auto shrink-0" aria-hidden="true" />}
                        {!rail && !gated && i.soon && <span className="ml-auto rounded-full border border-current px-2 py-0.5 text-[10px] opacity-70">segera</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${rail ? "justify-center" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent/15 text-xs font-semibold text-accent" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {user.photo ? <img src={`/api/files/avatar/${user.id}?v=${user.photo}`} alt="" width={36} height={36} className="size-9 object-cover" /> : initials}
            </span>
            {!rail && (
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{user.name}</p>
                <p className="truncate text-xs capitalize text-muted">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl border border-line text-muted transition-[color,transform] hover:text-fg active:scale-95 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={open}
          >
            <Menu size={20} />
          </button>
          <p className="ml-auto hidden text-sm text-muted sm:block">{user.email}</p>
          <ThemeMenu />
          <button onClick={logout} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm text-muted transition-[transform,color] hover:text-fg active:scale-[0.97]">
            <LogOut size={16} /> Keluar
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          {locked && <p role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm"><Lock size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />Menu lain terbuka setelah Anda mengganti kata sandi awal dan mengaktifkan 2FA (wajib untuk superadmin dan dokter).</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
