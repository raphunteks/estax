"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, Field, Input, Select, Skeleton, api, fmtDate, witaToday, addD } from "./kit";

type Promo = {
  id: string; name: string; desc: string; kind: "percent" | "amount" | "free"; value: number; tariffIds: string[]; poliklinikId?: string; doctorId?: string;
  start: string; end: string; quota: number; perPatient: number; audience: "all" | "new" | "returning"; code?: string; status: "draf" | "aktif" | "jeda";
  createdBy: string; announcedAt?: number; claims: number; views: number;
};
type Tariff = { id: string; name: string };
const KIND = { percent: "Diskon persen", amount: "Potongan nominal", free: "Gratis tindakan" };
const AUD = { all: "Semua pasien", new: "Pasien baru", returning: "Pasien lama" };
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
export const promoLabel = (p: Pick<Promo, "kind" | "value">) => (p.kind === "percent" ? `${p.value}%` : p.kind === "amount" ? rp(p.value) : "Gratis");
const blank = (): Omit<Promo, "id" | "createdBy" | "claims" | "views" | "announcedAt"> => ({ name: "", desc: "", kind: "percent", value: 10, tariffIds: [], start: witaToday(), end: addD(witaToday(), 30), quota: 0, perPatient: 1, audience: "all", code: "", status: "draf" });

function PromoForm({ init, id, canActivate, tariffs, onDone, onCancel }: { init: ReturnType<typeof blank>; id?: string; canActivate: boolean; tariffs: Tariff[]; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState(init);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const body = { ...f, code: f.code || undefined, poliklinikId: f.poliklinikId || undefined, doctorId: f.doctorId || undefined };
    const r = await api(id ? `/api/promos/${id}` : "/api/promos", id ? "PATCH" : "POST", body);
    setBusy(false);
    r.ok ? onDone() : setMsg(r.message ?? "Gagal menyimpan.");
  }
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Nama promo"><Input required value={f.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="Mis. Diskon Scaling Hari Kesehatan Gigi" /></Field></div>
      <div className="sm:col-span-2"><Field label="Deskripsi singkat" hint="Tampil di akun pasien dan di notifikasi."><Input value={f.desc} maxLength={400} onChange={(e) => set("desc", e.target.value)} /></Field></div>
      <Field label="Jenis"><Select value={f.kind} onChange={(e) => set("kind", e.target.value as Promo["kind"])}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      {f.kind !== "free" && <Field label={f.kind === "percent" ? "Persen (%)" : "Nominal (Rp)"}><Input type="number" min={1} max={f.kind === "percent" ? 100 : 100000000} value={f.value} onChange={(e) => set("value", Number(e.target.value))} /></Field>}
      <div className="sm:col-span-2"><Field label="Berlaku untuk tindakan" hint={f.kind === "free" ? "Wajib pilih tindakan yang digratiskan." : "Kosongkan agar berlaku untuk semua tindakan."}>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {tariffs.length === 0 && <span className="text-sm text-muted">Belum ada tarif di Kasir.</span>}
          {tariffs.map((t) => { const on = f.tariffIds.includes(t.id); return <button type="button" key={t.id} aria-pressed={on} onClick={() => set("tariffIds", on ? f.tariffIds.filter((x) => x !== t.id) : [...f.tariffIds, t.id])} className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${on ? "border-accent bg-accent/15 text-fg" : "border-line text-muted"}`}>{t.name}</button>; })}
        </div>
      </Field></div>
      <Field label="Mulai"><Input type="date" required value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
      <Field label="Selesai"><Input type="date" required value={f.end} min={f.start} onChange={(e) => set("end", e.target.value)} /></Field>
      <Field label="Kuota total" hint="0 = tanpa batas."><Input type="number" min={0} value={f.quota} onChange={(e) => set("quota", Number(e.target.value))} /></Field>
      <Field label="Maks. per pasien"><Input type="number" min={1} max={20} value={f.perPatient} onChange={(e) => set("perPatient", Number(e.target.value))} /></Field>
      <Field label="Untuk"><Select value={f.audience} onChange={(e) => set("audience", e.target.value as Promo["audience"])}>{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      <Field label="Kode promo (opsional)"><Input value={f.code ?? ""} maxLength={20} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SCALING20" /></Field>
      <Field label="Status"><Select value={canActivate ? f.status : "draf"} disabled={!canActivate} onChange={(e) => set("status", e.target.value as Promo["status"])}><option value="draf">Draf</option><option value="aktif">Aktif</option><option value="jeda">Dijeda</option></Select></Field>
      {!canActivate && <p className="self-end text-xs text-muted">Dokter menyimpan sebagai draf. Superadmin yang mengaktifkan.</p>}
      <div className="flex items-center gap-2 sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan promo"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Batal</button>
        <p role="alert" className="text-sm text-[var(--bad)]">{msg}</p>
      </div>
    </form>
  );
}

export default function Promos() {
  const [rows, setRows] = useState<Promo[] | null>(() => api.getCache<{ promos: Promo[] }>("/api/promos")?.promos ?? null);
  const [canActivate, setCan] = useState(() => Boolean(api.getCache<{ canActivate: boolean }>("/api/promos")?.canActivate));
  const [me, setMe] = useState(() => api.getCache<{ me: string }>("/api/promos")?.me ?? "");
  const [tariffs, setTariffs] = useState<Tariff[]>(() => api.getCache<{ tariffs: Tariff[] }>("/api/billing/tariffs")?.tariffs ?? []);
  const [edit, setEdit] = useState<{ id?: string; init: ReturnType<typeof blank> } | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ promos: Promo[]; canActivate: boolean; me: string }>("/api/promos");
    if (r.ok) { setRows(r.promos); setCan(r.canActivate); setMe(r.me); } else setRows([]);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { void load(); void api<{ tariffs: Tariff[] }>("/api/billing/tariffs").then((r) => r.ok && setTariffs(r.tariffs ?? [])); }, 0);
    return () => clearTimeout(t);
  }, [load]);
  const setStatus = async (p: Promo, status: Promo["status"]) => { const { id, claims: _c, views: _v, createdBy: _b, announcedAt: _a, ...rest } = p; void _c; void _v; void _b; void _a; const r = await api(`/api/promos/${id}`, "PATCH", { ...rest, status }); setMsg(r.ok ? "" : (r.message ?? "Gagal.")); void load(); };
  const announce = async (p: Promo) => { const r = await api<{ patients: number; devices: number }>(`/api/promos/${p.id}/announce`, "POST"); setMsg(r.ok ? `Diumumkan ke ${r.patients} akun pasien (${r.devices} perangkat menerima push).` : (r.message ?? "Gagal mengumumkan.")); void load(); };
  const del = async (p: Promo) => { const r = await api(`/api/promos/${p.id}`, "DELETE"); setMsg(r.ok ? "" : (r.message ?? "Gagal.")); void load(); };
  const today = witaToday();
  const state = (p: Promo) => p.status === "draf" ? ["Draf", "muted"] as const : p.status === "jeda" ? ["Dijeda", "warn"] as const : p.end < today ? ["Selesai", "muted"] as const : p.start > today ? ["Terjadwal", "warn"] as const : ["Berjalan", "ok"] as const;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Promosi</h1>
        {!edit && <button className="btn btn-primary" onClick={() => setEdit({ init: blank() })}>Buat promo</button>}
      </div>
      {msg && <p role="status" className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">{msg}</p>}
      {edit && <div className="mb-6"><Card title={edit.id ? "Ubah promo" : "Promo baru"}><PromoForm init={edit.init} id={edit.id} canActivate={canActivate} tariffs={tariffs} onCancel={() => setEdit(null)} onDone={() => (setEdit(null), void load())} /></Card></div>}
      {!rows ? <Skeleton /> : rows.length === 0 ? <Empty>Belum ada promo. Buat promo pertama, misalnya diskon scaling.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((p) => {
            const [label, tone] = state(p); const mine = p.createdBy === me;
            return (
              <li key={p.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{fmtDate(p.start)} sampai {fmtDate(p.end)}</p></div><Badge tone={tone}>{label}</Badge></div>
                <p className="display mt-2 text-2xl">{promoLabel(p)}<span className="ml-2 text-sm text-muted">{KIND[p.kind]}</span></p>
                {p.desc && <p className="mt-1 text-sm text-muted">{p.desc}</p>}
                <p className="mt-2 text-xs text-muted">{AUD[p.audience]} · maks. {p.perPatient}x/pasien · {p.quota ? `kuota ${p.quota}` : "tanpa kuota"}{p.code ? ` · kode ${p.code}` : ""}</p>
                <p className="mt-1 text-xs"><strong>{p.views}</strong> pasien melihat · <strong>{p.claims}</strong> dipakai{p.announcedAt ? ` · diumumkan ${fmtDate(new Date(p.announcedAt + 8 * 3600e3).toISOString().slice(0, 10))}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(canActivate || (mine && p.status === "draf")) && <button className="min-h-9 rounded-lg border border-line px-3 text-xs" onClick={() => setEdit({ id: p.id, init: { name: p.name, desc: p.desc, kind: p.kind, value: p.value, tariffIds: p.tariffIds, poliklinikId: p.poliklinikId, doctorId: p.doctorId, start: p.start, end: p.end, quota: p.quota, perPatient: p.perPatient, audience: p.audience, code: p.code ?? "", status: p.status } })}>Ubah</button>}
                  {canActivate && p.status !== "aktif" && <button className="min-h-9 rounded-lg border border-accent/50 px-3 text-xs" onClick={() => void setStatus(p, "aktif")}>Aktifkan</button>}
                  {canActivate && p.status === "aktif" && <button className="min-h-9 rounded-lg border border-line px-3 text-xs" onClick={() => void setStatus(p, "jeda")}>Jeda</button>}
                  {canActivate && label === "Berjalan" && <button className="min-h-9 rounded-lg border border-line px-3 text-xs" onClick={() => void announce(p)}>Umumkan ke pasien</button>}
                  {(canActivate || mine) && <button className="min-h-9 rounded-lg border border-red-400/40 px-3 text-xs text-red-300" onClick={() => void del(p)}>Hapus</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
