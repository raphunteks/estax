"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, BarChart3, CalendarDays, ChevronRight, ClipboardCheck, Cog, Globe, MessageCircle, Package, Pill, ScrollText, ShieldCheck, Sparkles, Star, Stethoscope, Tag, Users, Wallet, type LucideIcon } from "lucide-react";
import { Skeleton, api } from "./kit";

type K = { label: string; value: number; href: string; tone: keyof typeof TINT };
type Quick = { href: string; label: string; icon: string };
const TINT = { rose: "#f43f5e", sky: "#38bdf8", amber: "#f59e0b", green: "#10b981", violet: "#8b5cf6", teal: "#14b8a6" } as const;
const NAV_ICONS: Record<string, LucideIcon> = { users: Users, calendar: CalendarDays, tooth: Stethoscope, wallet: Wallet, pill: Pill, chart: BarChart3, spark: Sparkles, shield: ShieldCheck, cog: Cog, log: ScrollText, globe: Globe, tag: Tag, chat: MessageCircle, star: Star };
const QUICK_TONE: (keyof typeof TINT)[] = ["sky", "teal", "amber", "violet", "rose", "green"];
const tint = (c: keyof typeof TINT) => ({ "--t": TINT[c], background: "color-mix(in oklab, var(--t) 13%, transparent)", borderColor: "color-mix(in oklab, var(--t) 28%, transparent)" }) as React.CSSProperties;

/** Icon for a KPI, derived from where it links to. */
function kpiIcon(href: string): LucideIcon {
  if (href.includes("pesan")) return MessageCircle;
  if (href.includes("kasir")) return Wallet;
  if (href.includes("stock")) return Package;
  if (href.includes("farmasi")) return Pill;
  if (href.includes("req")) return ClipboardCheck;
  if (href.includes("janji")) return CalendarDays;
  return Activity;
}

/** Role-specific live KPI tiles plus an RBAC-filtered quick-menu grid for the dashboard home. Refreshed every 10 s while visible. */
export default function RoleKpi({ quick = [] }: { quick?: Quick[] }) {
  const [k, setK] = useState<K[] | null>(null);
  useEffect(() => {
    const load = () => void api<{ kpis: K[] }>("/api/dash/mobile").then((r) => r.ok && setK(r.kpis));
    const t = setTimeout(load, 0);
    const i = setInterval(() => document.visibilityState === "visible" && load(), 10000);
    return () => (clearTimeout(t), clearInterval(i));
  }, []);
  return (
    <>
      {!k ? (
        <div className="mb-6"><Skeleton /></div>
      ) : k.length > 0 ? (
        <section aria-label="Perlu perhatian" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {k.map((x) => {
            const I = kpiIcon(x.href);
            return (
              <Link key={x.label} href={x.href} style={tint(x.tone)} className="flex flex-col rounded-2xl border p-4 transition-transform active:scale-[0.97]">
                <I size={22} aria-hidden="true" style={{ color: "var(--t)" }} />
                <p className="display mt-3 text-3xl leading-none tabular-nums">{x.value}</p>
                <p className="mt-1.5 text-xs leading-tight text-muted">{x.label}</p>
              </Link>
            );
          })}
        </section>
      ) : null}
      {quick.length > 0 && (
        <section aria-label="Menu cepat" className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted">Menu cepat</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {quick.map((q, n) => {
              const I = NAV_ICONS[q.icon] ?? Activity;
              return (
                <Link key={q.href} href={q.href} style={tint(QUICK_TONE[n % QUICK_TONE.length])} className="flex min-h-24 flex-col justify-between rounded-2xl border p-3 transition-transform active:scale-[0.97]">
                  <I size={24} aria-hidden="true" style={{ color: "var(--t)" }} />
                  <span className="flex items-end justify-between gap-1 text-sm font-medium leading-tight">{q.label}<ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
