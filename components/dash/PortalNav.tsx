"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import ThemeMenu from "@/components/ThemeMenu";

const ITEMS: [string, string, boolean][] = [
  ["/portal", "Ringkasan", true],
  ["/portal/akun", "Akun saya", true],
  ["/portal/janji", "Janji", true],
  ["/portal/riwayat", "Riwayat", true],
  ["/portal/tagihan", "Tagihan", true],
  ["/portal/tanya", "Tanya", true],
  ["/portal/bicara", "Telepon AI", true],
];

export default function PortalNav({ locked }: { locked: boolean }) {
  const path = usePathname();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/masuk");
  };
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-4">
        <Link href="/portal" className="flex items-center gap-2 text-accent" aria-label="Portal pasien"><Logo size={28} /><span className="display hidden text-xl text-fg sm:inline">Estaka</span></Link>
        <ThemeMenu sheet="md" align="left" />
        <nav aria-label="Portal" className="hidden flex-1 gap-1 overflow-x-auto md:flex">
          {ITEMS.map(([href, label, live]) =>
            live && !(locked && href !== "/portal/akun") ? (
              <Link key={label} href={href} aria-current={path === href ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${path === href ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}>{label}</Link>
            ) : (
              <span key={label} aria-disabled="true" className="inline-flex min-h-10 shrink-0 cursor-not-allowed items-center rounded-lg px-3 text-sm opacity-45">{label}</span>
            ),
          )}
        </nav>
        <span className="flex-1 md:hidden" /><button onClick={logout} className="min-h-10 rounded-xl border border-line px-3 text-sm text-muted transition-[transform,color] hover:text-fg active:scale-[0.97]">Keluar</button>
      </div>
    </header>
  );
}

const I = (d: React.ReactNode) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const TABS: { href: string; label: string; icon: React.ReactNode; main?: boolean }[] = [
  { href: "/portal", label: "Beranda", icon: I(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>) },
  { href: "/portal/riwayat", label: "Riwayat", icon: I(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>) },
  { href: "/portal/janji", label: "Janji", main: true, icon: I(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5" /></>) },
  { href: "/portal/tagihan", label: "Tagihan", icon: I(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>) },
  { href: "/portal/akun", label: "Akun", icon: I(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>) },
];

/** Mobile bottom tab bar (the centre button is the main action). Hidden from md up, where the top nav is used. */
export function PortalTabBar({ locked }: { locked: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
        {TABS.map((t) => {
          const on = t.href === "/portal" ? path === "/portal" : path.startsWith(t.href);
          const off = locked && t.href !== "/portal/akun";
          const cls = `flex min-h-14 flex-col items-center justify-end gap-0.5 pb-1.5 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-[0.95] ${on ? "text-accent" : "text-muted"} ${off ? "pointer-events-none opacity-40" : ""}`;
          return (
            <li key={t.href}>
              <Link href={off ? "#" : t.href} aria-current={on ? "page" : undefined} aria-disabled={off || undefined} className={cls}>
                {t.main ? <span className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">{t.icon}</span> : t.icon}
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
