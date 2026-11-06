"use client";

import ThemeMenu from "@/components/ThemeMenu";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, ChevronDown, Cog, Globe, Home, Lock, LogOut, PanelLeftClose, PanelLeftOpen, ScrollText, ShieldCheck, Tag, MessageCircle, Star, Sparkles, Stethoscope, User, Users, Wallet, Pill, BarChart3, X, type LucideIcon } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import Logo from "@/components/Logo";
import BottomNav from "./BottomNav";

const ICONS: Record<string, LucideIcon> = { home: Home, users: Users, calendar: CalendarDays, tooth: Stethoscope, wallet: Wallet, pill: Pill, chart: BarChart3, spark: Sparkles, shield: ShieldCheck, cog: Cog, log: ScrollText, globe: Globe, user: User, tag: Tag, chat: MessageCircle, star: Star };
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
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const rail = useSyncExternalStore(sub, () => read("rail") === "1", () => false);
  const openRaw = useSyncExternalStore(sub, () => read("navopen"), () => "");
  const openMap = (() => { try { return JSON.parse(openRaw || "{}") as Record<string, boolean>; } catch { return {}; } })();

  // Mobile drawer: slides on transform only, ease-out 240ms. Under reduced motion it just toggles visibility.
  const { contextSafe } = useGSAP({ scope: root });
  const slide = contextSafe((show: boolean) => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(".dash-aside", { translate: show ? "0% 0" : "-100% 0", duration: mm ? 0 : 0.24, ease: "power3.out", overwrite: true });
  });
  useEffect(() => slide(open), [open, slide]);
  // The drawer sets an inline `translate` on narrow screens; once the viewport grows past lg (resize, devtools, rotate)
  // that inline value would keep the sidebar off-screen, so clear it and let the CSS take over.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) {
        gsap.killTweensOf(".dash-aside");
        gsap.set(".dash-aside", { clearProps: "translate" });
        setOpen(false);
      } else slide(open);
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [open, slide]);

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
    <div ref={root} className="min-h-dvh lg:flex">
      {open && <button aria-label="Tutup menu" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        aria-label="Navigasi dashboard"
        className={`dash-aside fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:transition-[width] lg:duration-200 ${rail ? "lg:w-[72px]" : "lg:w-64"}`}
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
          <Link href="/dashboard" aria-label="Estaka, ke Beranda" className="flex items-center gap-2 lg:hidden"><Logo size={34} className="shrink-0" /><span className="display text-xl">Estaka</span></Link>
          <p className="ml-auto hidden text-sm text-muted lg:order-2 lg:block">{user.email}</p>
          <span className="lg:order-3"><ThemeMenu /></span>
          <button onClick={logout} className="ml-auto inline-flex min-h-10 lg:order-4 lg:ml-0 items-center gap-2 rounded-xl border border-line px-3 text-sm text-muted transition-[transform,color] hover:text-fg active:scale-[0.97]">
            <LogOut size={16} /> Keluar
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 pb-32 sm:px-6 lg:pb-8">
          {locked && <p role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm"><Lock size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />Menu lain terbuka setelah Anda mengganti kata sandi awal dan mengaktifkan 2FA (wajib untuk superadmin dan dokter).</p>}
          {children}
        </main>
      </div>
      <BottomNav role={user.role} locked={locked} items={items} icons={ICONS} />
    </div>
  );
}
