"use client";

import { useRef } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap-lite";
import type { Stats } from "@/lib/clinic/stats";

const C1 = "var(--accent)";
const C2 = "#8aa4ff";
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--fg)", fontSize: 12 }, cursor: { fill: "var(--line)" } };

function Panel({ title, sub, children, empty, label }: { title: string; sub?: string; children: React.ReactNode; empty: boolean; label: string }) {
  return (
    <section className="glass ch-card rounded-2xl p-5" aria-label={label}>
      <h2 className="display text-lg">{title}</h2>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <div className="mt-3 h-56">{empty ? <p className="grid h-full place-items-center rounded-xl border border-dashed border-line text-sm text-muted">Belum ada data</p> : children}</div>
    </section>
  );
}

export default function Charts({ s }: { s: Stats }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(".ch-card", { y: 14, opacity: 0, duration: 0.4, stagger: 0.06, ease: "power3.out", clearProps: "all" });
        gsap.utils.toArray<HTMLElement>(".kpi-n").forEach((el) => {
          const to = Number(el.dataset.v);
          if (!Number.isFinite(to) || to === 0) return;
          const o = { n: 0 };
          gsap.to(o, { n: to, duration: 0.7, ease: "power2.out", onUpdate: () => void (el.textContent = String(Math.round(o.n))) });
        });
      });
    },
    { scope: root },
  );
  const total = s.perDay.reduce((a, b) => a + b.visits, 0);
  const pct = Math.min(100, Math.round((s.target.value / s.target.goal) * 100));
  const kpis: [string, number | null, string][] = [["Janji hari ini", s.kpi.today, ""], ["Menunggu konfirmasi", s.kpi.pending, ""], ["Di ruang tunggu", s.kpi.waiting, ""], ["Selesai hari ini", s.kpi.done, ""], ["Total pasien", s.kpi.patients, ""], ["Rata-rata tunggu", s.kpi.avgWait, " mnt"]];
  return (
    <div ref={root}>
      <div className="hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-6">
        {kpis.filter(([, v]) => v !== null || false).map(([l, v, u]) => (
          <div key={l} className="glass ch-card rounded-2xl p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className="display mt-1 text-3xl"><span className="kpi-n" data-v={v ?? 0}>{v}</span><span className="text-base text-muted">{u}</span></p>
          </div>
        ))}
        {s.kpi.avgWait === null && <div className="glass ch-card rounded-2xl p-4"><p className="text-xs text-muted">Rata-rata tunggu</p><p className="mt-2 text-sm text-muted">Belum ada data</p></div>}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Kunjungan 30 hari" sub={`${total} janji aktif/selesai`} empty={total === 0} label="Grafik area kunjungan 30 hari terakhir">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.perDay} margin={{ left: -20, right: 8, top: 8 }}>
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C1} stopOpacity={0.5} /><stop offset="100%" stopColor={C1} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip {...tip} formatter={(v) => [v, "Kunjungan"]} />
              <Area type="monotone" dataKey="visits" stroke={C1} strokeWidth={2} fill="url(#gv)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Kunjungan per poliklinik" sub="Grafik tindakan menyusul di Fase 3" empty={s.byPoli.length === 0} label="Grafik batang kunjungan per poliklinik">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.byPoli} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip {...tip} formatter={(v) => [v, "Kunjungan"]} />
              <Bar dataKey="total" fill={C1} radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Pasien baru vs lama" sub="30 hari terakhir" empty={s.mix.every((m) => m.total === 0)} label="Grafik pai pasien baru dan lama">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip {...tip} />
              <Pie data={s.mix} dataKey="total" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none" isAnimationActive={false} label={({ name, value }) => `${name} ${value}`}>
                <Cell fill={C1} /><Cell fill={C2} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Target bulan ini" sub={`${s.target.value} dari ${s.target.goal} kunjungan`} empty={false} label="Grafik radial target kunjungan bulanan">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="68%" outerRadius="100%" data={[{ v: pct }]} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="v" cornerRadius={12} fill={C1} background={{ fill: "var(--line)" }} isAnimationActive={false} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="var(--fg)" style={{ fontSize: 32, fontFamily: "var(--font-display)" }}>{pct}%</text>
            </RadialBarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}
