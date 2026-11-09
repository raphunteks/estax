"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Empty, Select, Skeleton, Tabs, api } from "./kit";
import { rp } from "./Billing";

type Pt = { name: string; value: number };
type D = {
  from: string; to: string; days: number; sections: string[]; waitTarget: number;
  visits?: { total: number; booked: number; perDay: { label: string; visits: number; booked: number }[]; byWeekday: Pt[]; byHour: Pt[] };
  procedures?: { total: number; perVisit: number; top: Pt[] };
  retention?: { patients: number; newPatients: number; returning: number; repeatRate: number | null; avgGapDays: number | null; cohort: Pt[] };
  wait?: { samples: number; avg: number | null; median: number | null; p90: number | null; chairAvg: number | null; withinTarget: number | null; buckets: Pt[] };
  funnel?: { stages: Pt[]; lost: Record<string, number>; bySource: Record<string, number>; completion: number | null };
  revenue?: { received: number; billed: number; outstanding: number; invoices: number; avgInvoice: number; perDay: { label: string; value: number }[]; byMethod: Pt[] };
  doctors?: { id: string; name: string; visits: number; patients: number; noShow: number | null; avgWait: number | null; avgChair: number | null; revenue: number | null }[];
  pharmacy?: { items: number; low: { name: string; stock: number; min: number; unit: string }[]; expired: { name: string; qty: number; unit: string }[]; expiring: { name: string; qty: number; unit: string }[]; stockValue: number; rxWaiting: number; topDispensed: Pt[]; basis: string };
};
const A1 = "var(--accent)", A2 = "#8aa4ff", A3 = "#5eead4", A4 = "#fbbf24";
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--fg)", fontSize: 12 }, cursor: { fill: "var(--line)" } };
const ax = { tickLine: false, axisLine: false, tick: { fill: "var(--muted)", fontSize: 11 } } as const;
const LABELS: Record<string, string> = { visits: "Kunjungan", revenue: "Pendapatan", procedures: "Tindakan", retention: "Retensi", wait: "Waktu tunggu", doctors: "Per dokter", funnel: "Funnel booking", pharmacy: "Farmasi" };

function Panel({ title, sub, empty, h = "h-56", className = "", children }: { title: string; sub?: string; empty?: boolean; h?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`glass rounded-2xl p-5 ${className}`} aria-label={title}>
      <h2 className="display text-lg">{title}</h2>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <div className={`mt-3 ${empty ? "h-40" : h}`}>{empty ? <p className="grid h-full place-items-center rounded-xl border border-dashed border-line text-sm text-muted">Belum ada data pada periode ini</p> : children}</div>
    </section>
  );
}
const Kpi = ({ l, v, u = "" }: { l: string; v: string | number | null; u?: string }) => (
  <div className="glass rounded-2xl p-4"><p className="text-xs text-muted">{l}</p><p className="display mt-1 text-2xl sm:text-3xl">{v === null ? "-" : v}<span className="text-base text-muted">{v === null ? "" : u}</span></p></div>
);
const Bars = ({ data, color = A1, layout = "horizontal" }: { data: Pt[]; color?: string; layout?: "horizontal" | "vertical" }) => (
  <ResponsiveContainer width="100%" height="100%">
    {layout === "vertical" ? (
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid horizontal={false} stroke="var(--line)" /><XAxis type="number" allowDecimals={false} {...ax} /><YAxis type="category" dataKey="name" width={120} {...ax} /><Tooltip {...tip} /><Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} /></BarChart>
    ) : (
      <BarChart data={data} margin={{ left: -20, right: 8 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="name" {...ax} /><YAxis allowDecimals={false} {...ax} /><Tooltip {...tip} /><Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} /></BarChart>
    )}
  </ResponsiveContainer>
);

function Visits({ d }: { d: NonNullable<D["visits"]> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi l="Kunjungan selesai" v={d.total} /><Kpi l="Janji aktif + selesai" v={d.booked} /><Kpi l="Rata-rata per hari" v={Math.round((d.total / Math.max(1, d.perDay.length)) * 10) / 10} /><Kpi l="Hari tersibuk" v={[...d.byWeekday].sort((a, b) => b.value - a.value)[0]?.value ? [...d.byWeekday].sort((a, b) => b.value - a.value)[0].name : null} /></div>
      <Panel title="Tren kunjungan" sub="Selesai dan janji aktif per hari" empty={!d.booked} className="">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={d.perDay} margin={{ left: -20, right: 8, top: 8 }}><defs><linearGradient id="av" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={A1} stopOpacity={0.5} /><stop offset="100%" stopColor={A1} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} {...ax} /><YAxis allowDecimals={false} {...ax} /><Tooltip {...tip} /><Area type="monotone" dataKey="booked" name="Janji aktif" stroke={A2} fill="none" strokeDasharray="4 4" /><Area type="monotone" dataKey="visits" name="Selesai" stroke={A1} fill="url(#av)" strokeWidth={2} /></AreaChart></ResponsiveContainer>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2"><Panel title="Per hari dalam seminggu" empty={!d.total}><Bars data={d.byWeekday} /></Panel><Panel title="Per jam janji" empty={!d.total}><Bars data={d.byHour} color={A2} /></Panel></div>
    </div>
  );
}

function Revenue({ d }: { d: NonNullable<D["revenue"]> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi l="Kas diterima" v={rp(d.received)} /><Kpi l="Ditagihkan" v={rp(d.billed)} /><Kpi l="Piutang" v={rp(d.outstanding)} /><Kpi l="Rata-rata invoice" v={rp(d.avgInvoice)} /></div>
      <Panel title="Kas diterima per hari" empty={!d.received}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={d.perDay} margin={{ left: 0, right: 8, top: 8 }}><defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={A3} stopOpacity={0.5} /><stop offset="100%" stopColor={A3} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} {...ax} /><YAxis width={56} tickFormatter={(v: number) => (v >= 1e6 ? `${v / 1e6}jt` : v >= 1e3 ? `${v / 1e3}rb` : String(v))} {...ax} /><Tooltip {...tip} formatter={(v) => [rp(Number(v)), "Kas"]} /><Area type="monotone" dataKey="value" stroke={A3} fill="url(#rv)" strokeWidth={2} /></AreaChart></ResponsiveContainer>
      </Panel>
      <Panel title="Metode pembayaran" empty={!d.byMethod.length}><ResponsiveContainer width="100%" height="100%"><BarChart data={d.byMethod} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid horizontal={false} stroke="var(--line)" /><XAxis type="number" tickFormatter={(v: number) => (v >= 1e6 ? `${v / 1e6}jt` : `${v / 1e3}rb`)} {...ax} /><YAxis type="category" dataKey="name" width={80} {...ax} /><Tooltip {...tip} formatter={(v) => [rp(Number(v)), "Diterima"]} /><Bar dataKey="value" fill={A3} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></Panel>
    </div>
  );
}

function Procedures({ d }: { d: NonNullable<D["procedures"]> }) {
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Kpi l="Total tindakan" v={d.total} /><Kpi l="Tindakan per kunjungan" v={d.perVisit} /></div><Panel title="10 tindakan terbanyak" empty={!d.top.length} h="h-80"><Bars data={d.top} layout="vertical" color={A2} /></Panel></div>;
}

function Retention({ d }: { d: NonNullable<D["retention"]> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi l="Pasien dilayani" v={d.patients} /><Kpi l="Pasien baru" v={d.newPatients} /><Kpi l="Pasien kembali" v={d.returning} /><Kpi l="Pernah kontrol ulang" v={d.repeatRate} u="%" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Baru vs kembali" empty={!d.patients}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={d.cohort} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">{d.cohort.map((_, i) => <Cell key={i} fill={[A1, A3][i]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer></Panel>
        <Panel title="Jarak antar kunjungan" sub="Rata-rata hari antara dua kunjungan selesai berturut-turut" empty={d.avgGapDays === null}><div className="grid h-full place-items-center"><p className="display text-5xl">{d.avgGapDays}<span className="text-lg text-muted"> hari</span></p></div></Panel>
      </div>
    </div>
  );
}

function Wait({ d, target }: { d: NonNullable<D["wait"]>; target: number }) {
  const v = d.withinTarget ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi l="Rata-rata tunggu" v={d.avg} u=" mnt" /><Kpi l="Median" v={d.median} u=" mnt" /><Kpi l="90% pasien ≤" v={d.p90} u=" mnt" /><Kpi l="Rata-rata di kursi" v={d.chairAvg} u=" mnt" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Dilayani ≤ ${target} menit`} sub={`${d.samples} pasien dengan waktu check-in dan dipanggil tercatat`} empty={!d.samples}>
          <div className="relative h-full"><ResponsiveContainer width="100%" height="100%"><RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ v }]} startAngle={210} endAngle={-30}><PolarAngleAxis type="number" domain={[0, 100]} tick={false} /><RadialBar dataKey="v" cornerRadius={12} background={{ fill: "var(--line)" }} fill={v >= 80 ? A3 : v >= 50 ? A4 : "#f87171"} /></RadialBarChart></ResponsiveContainer><p className="display absolute inset-0 grid place-items-center text-4xl">{v}%</p></div>
        </Panel>
        <Panel title="Sebaran waktu tunggu" empty={!d.samples}><Bars data={d.buckets} color={A4} /></Panel>
      </div>
    </div>
  );
}

function Doctors({ d }: { d: NonNullable<D["doctors"]> }) {
  if (!d.length) return <Empty>Belum ada data dokter pada periode ini.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-xs text-muted"><tr><th className="p-3">Dokter</th><th className="text-right">Selesai</th><th className="text-right">Pasien</th><th className="text-right">Tidak hadir</th><th className="text-right">Tunggu</th><th className="text-right">Di kursi</th>{d.some((x) => x.revenue !== null) && <th className="p-3 text-right">Kas diterima</th>}</tr></thead>
        <tbody>{d.map((x) => <tr key={x.id} className="border-t border-line"><td className="p-3 font-medium">{x.name}</td><td className="text-right">{x.visits}</td><td className="text-right">{x.patients}</td><td className="text-right">{x.noShow === null ? "-" : `${x.noShow}%`}</td><td className="text-right">{x.avgWait === null ? "-" : `${x.avgWait} mnt`}</td><td className="text-right">{x.avgChair === null ? "-" : `${x.avgChair} mnt`}</td>{x.revenue !== null && <td className="p-3 text-right">{rp(x.revenue)}</td>}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Funnel({ d }: { d: NonNullable<D["funnel"]> }) {
  const max = Math.max(1, d.stages[0]?.value ?? 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi l="Janji selesai" v={d.completion} u="%" /><Kpi l="Dibatalkan pasien" v={d.lost.batal_pasien} /><Kpi l="Dibatalkan klinik" v={d.lost.batal_klinik} /><Kpi l="Tidak hadir" v={d.lost.tidak_hadir} /></div>
      <Panel title="Dari janji sampai selesai" empty={!d.stages[0]?.value} h="h-auto">
        <ol className="space-y-3 py-1">{d.stages.map((s, i) => <li key={s.name}><div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="text-muted">{s.value}{i > 0 && d.stages[i - 1].value ? ` · ${Math.round((s.value / d.stages[i - 1].value) * 100)}% dari tahap sebelumnya` : ""}</span></div><div className="h-3 rounded-full bg-line" role="img" aria-label={`${s.name}: ${s.value}`}><div className="h-3 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(s.value / max) * 100}%` }} /></div></li>)}</ol>
      </Panel>
      <p className="text-sm text-muted">Sumber janji: {Object.entries(d.bySource).map(([k, v]) => `${k === "portal" ? "portal pasien" : "staf"} ${v}`).join(" · ") || "-"}</p>
    </div>
  );
}

function Pharm({ d }: { d: NonNullable<D["pharmacy"]> }) {
  const list = (rows: { name: string; unit: string; qty?: number; stock?: number; min?: number }[], none: string) => rows.length ? <ul className="space-y-1 text-sm">{rows.map((r) => <li key={r.name} className="flex justify-between gap-3"><span>{r.name}</span><span className="text-muted">{r.stock !== undefined ? `${r.stock}/${r.min} ${r.unit}` : `${r.qty} ${r.unit}`}</span></li>)}</ul> : <p className="text-sm text-muted">{none}</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi l="Item aktif" v={d.items} /><Kpi l="Resep menunggu" v={d.rxWaiting} /><Kpi l="Stok menipis" v={d.low.length} /><Kpi l="Nilai stok" v={rp(d.stockValue)} /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Stok menipis" h="h-auto">{list(d.low, "Semua di atas minimum.")}</Panel>
        <Panel title="Kedaluwarsa" h="h-auto">{list(d.expired, "Tidak ada.")}</Panel>
        <Panel title="Kedaluwarsa ≤ 60 hari" h="h-auto">{list(d.expiring, "Tidak ada.")}</Panel>
      </div>
      <Panel title="Obat paling banyak diserahkan" sub={d.basis} empty={!d.topDispensed.length}><Bars data={d.topDispensed} layout="vertical" color={A3} /></Panel>
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<D | null>(() => {
    const c = api.getCache<D>(`/api/analytics?days=30`);
    return c && c.ok ? (c as unknown as D) : null;
  });
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(() => {
    const c = api.getCache<D>(`/api/analytics?days=30`);
    return c && (c as unknown as D).sections ? (c as unknown as D).sections[0] : "";
  });
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const r = await api<D>(`/api/analytics?days=${days}`);
      if (!live) return;
      if (!r.ok) return setErr(r.message ?? "Gagal memuat analitik.");
      setErr("");
      setD(r as unknown as D);
      setTab((cur) => ((r as unknown as D).sections.includes(cur) ? cur : (r as unknown as D).sections[0]));
    }, 0);
    return () => { live = false; clearTimeout(t); };
  }, [days]);
  if (err) return <p role="alert" className="text-sm text-red-400">{err}</p>;
  if (!d) return <Skeleton />;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="display text-3xl">Analitik</h1><p className="text-sm text-muted">{d.from} s/d {d.to}</p></div>
        <Select aria-label="Periode" value={days} onChange={(e) => setDays(Number(e.target.value))} className="max-w-[11rem]"><option value={7}>7 hari</option><option value={30}>30 hari</option><option value={90}>90 hari</option></Select>
      </div>
      {d.sections.length > 1 && <Tabs tabs={d.sections.map((s) => [s, LABELS[s]] as [string, string])} value={tab} onChange={setTab} />}
      {d.sections.length === 1 && <Badge>{LABELS[d.sections[0]]}</Badge>}
      <div className="mt-4">
        {tab === "visits" && d.visits && <Visits d={d.visits} />}
        {tab === "revenue" && d.revenue && <Revenue d={d.revenue} />}
        {tab === "procedures" && d.procedures && <Procedures d={d.procedures} />}
        {tab === "retention" && d.retention && <Retention d={d.retention} />}
        {tab === "wait" && d.wait && <Wait d={d.wait} target={d.waitTarget} />}
        {tab === "doctors" && d.doctors && <Doctors d={d.doctors} />}
        {tab === "funnel" && d.funnel && <Funnel d={d.funnel} />}
        {tab === "pharmacy" && d.pharmacy && <Pharm d={d.pharmacy} />}
      </div>
    </div>
  );
}
