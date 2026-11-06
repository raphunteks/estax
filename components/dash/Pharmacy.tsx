"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, Field, Input, Select, Skeleton, Tabs, api, addD, fmtDate, witaToday } from "./kit";

type Batch = { id: string; qty: number; expiry?: string; lot?: string };
type It = { id: string; name: string; kind: "obat" | "bahan" | "alat"; unit: string; min: number; price?: number; active: boolean; batches: Batch[]; stock: number; usable: number; editable: boolean };
const KIND = { obat: "Obat", bahan: "Bahan", alat: "Alat" } as const;
const n0 = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

function Row({ it, onDone }: { it: It; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(0);
  const [exp, setExp] = useState("");
  const [lot, setLot] = useState("");
  const [count, setCount] = useState(it.stock);
  const [min, setMin] = useState(it.min);
  const [msg, setMsg] = useState("");
  const today = witaToday();
  const expired = it.batches.some((b) => b.expiry && b.expiry < today && b.qty > 0);
  const soon = it.batches.some((b) => b.expiry && b.expiry >= today && b.expiry <= addD(today, 60) && b.qty > 0);
  const send = async (body: object, ok: string) => {
    const r = await api(`/api/pharmacy/items/${it.id}`, "PATCH", body);
    setMsg(r.ok ? ok : r.message ?? "Gagal.");
    if (r.ok) onDone();
  };
  return (
    <li className="border-t border-line py-3 first:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button className="text-left font-medium underline-offset-4 hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>{it.name}</button>
        <Badge>{KIND[it.kind]}</Badge>
        {!it.active && <Badge tone="muted">Nonaktif</Badge>}
        {it.usable < it.min && it.active && <Badge tone="warn">Stok menipis</Badge>}
        {expired && <Badge tone="bad">Ada kedaluwarsa</Badge>}
        {!expired && soon && <Badge tone="warn">Hampir kedaluwarsa</Badge>}
        <span className="ml-auto text-sm">{it.stock} {it.unit} <span className="text-muted">(min {it.min})</span></span>
      </div>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-line p-3 text-sm">
          {msg && <p role="status">{msg}</p>}
          <ul className="text-muted">{it.batches.length ? it.batches.map((b) => <li key={b.id}>{b.qty} {it.unit}{b.expiry ? ` · ED ${fmtDate(b.expiry)}` : ""}{b.lot ? ` · lot ${b.lot}` : ""}</li>) : <li>Tidak ada stok.</li>}</ul>
          {it.editable ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
                <Field label="Jumlah masuk"><Input type="number" min={1} value={qty || ""} onChange={(e) => setQty(n0(e.target.value))} /></Field>
                <Field label="Kedaluwarsa"><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
                <Field label="No. lot"><Input value={lot} maxLength={40} onChange={(e) => setLot(e.target.value)} /></Field>
                <button disabled={qty < 1} className="min-h-11 rounded-xl bg-accent/20 px-4 text-accent disabled:opacity-40" onClick={() => send({ restock: { qty, expiry: exp || undefined, lot: lot || undefined } }, "Stok masuk dicatat.")}>Restock</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[8rem_8rem_auto_auto] sm:items-end">
                <Field label="Hasil opname"><Input type="number" min={0} value={count} onChange={(e) => setCount(n0(e.target.value))} /></Field>
                <Field label="Stok minimum"><Input type="number" min={0} value={min} onChange={(e) => setMin(n0(e.target.value))} /></Field>
                <button className="min-h-11 rounded-xl border border-line px-4" onClick={() => send({ count: { qty: count } }, "Opname disimpan.")}>Simpan opname</button>
                <button className="min-h-11 rounded-xl border border-line px-4" onClick={() => send({ min, active: it.active }, "Disimpan.")}>Simpan minimum</button>
              </div>
              <button className="text-xs text-muted underline underline-offset-4" onClick={() => send({ active: !it.active }, it.active ? "Dinonaktifkan." : "Diaktifkan.")}>{it.active ? "Nonaktifkan item" : "Aktifkan item"}</button>
            </>
          ) : <p className="text-muted">Hanya apoteker atau superadmin yang mengubah stok obat.</p>}
        </div>
      )}
    </li>
  );
}

function Stock() {
  const [items, setItems] = useState<It[] | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [q, setQ] = useState("");
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: "", kind: "obat", unit: "tablet", min: 10 });
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ items: It[]; canCreate: boolean }>("/api/pharmacy/items");
    setItems(r.ok ? r.items : []);
    setCanCreate(Boolean(r.ok && r.canCreate));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  if (!items) return <Skeleton />;
  const shown = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Cari item" placeholder="Cari obat, bahan, alat" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {canCreate && <button className="rounded-full border border-line px-4 py-2 text-sm" onClick={() => setAdd(!add)}>{add ? "Tutup" : "Tambah item"}</button>}
      </div>
      {add && (
        <Card title="Item baru">
          {msg && <p role="status" className="mb-2 text-sm">{msg}</p>}
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_8rem_auto] sm:items-end">
            <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Jenis"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="obat">Obat</option><option value="bahan">Bahan</option><option value="alat">Alat</option></Select></Field>
            <Field label="Satuan"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
            <Field label="Minimum"><Input type="number" min={0} value={f.min} onChange={(e) => setF({ ...f, min: n0(e.target.value) })} /></Field>
            <button className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg" onClick={async () => { const r = await api("/api/pharmacy/items", "POST", f); setMsg(r.ok ? "Item ditambahkan." : r.message ?? "Gagal (staf hanya boleh bahan/alat)."); if (r.ok) (setF({ ...f, name: "" }), void load()); }}>Simpan</button>
          </div>
        </Card>
      )}
      {!shown.length ? <Empty>Belum ada item.</Empty> : <ul className="glass rounded-2xl px-4">{shown.map((i) => <Row key={i.id} it={i} onDone={load} />)}</ul>}
    </div>
  );
}

type RxRow = { visitId: string; date: string; patientName: string; rmNo: string | null; lines: number; no?: number; called?: boolean };
type RxFull = { rx: { visitId: string; lines: { id: string; drug: string; dose: string; freq: string; days: string; note?: string }[]; allergies: string; status: string }; patient: { name: string; rmNo: string | null } };

function Dispense({ id, onDone, onClose }: { id: string; onDone: () => void; onClose: () => void }) {
  const [d, setD] = useState<RxFull | null>(null);
  const [items, setItems] = useState<It[]>([]);
  const [pick, setPick] = useState<Record<string, { itemId: string; qty: number }>>({});
  const [warn, setWarn] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const t = setTimeout(async () => {
      const [r, i] = await Promise.all([api<RxFull>(`/api/pharmacy/rx/${id}`), api<{ items: It[] }>("/api/pharmacy/items")]);
      if (!r.ok || !i.ok) return setMsg("Gagal memuat resep.");
      const obat = i.items.filter((x) => x.kind === "obat" && x.active);
      setItems(obat); setD(r as unknown as RxFull);
      setPick(Object.fromEntries((r as unknown as RxFull).rx.lines.map((l) => { const m = obat.find((x) => l.drug.toLowerCase().includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(l.drug.toLowerCase())); const per = Number(l.days) || 1; return [l.id, { itemId: m?.id ?? "", qty: m ? per : 0 }]; })));
    }, 0);
    return () => clearTimeout(t);
  }, [id]);
  if (!d) return msg ? <p className="text-sm text-red-400">{msg}</p> : <Skeleton />;
  const submit = async (ack: boolean) => {
    const body = { ack, items: d.rx.lines.map((l) => ({ lineId: l.id, itemId: pick[l.id]?.itemId || null, qty: pick[l.id]?.itemId ? pick[l.id].qty : 0 })) };
    const r = await api<{ warnings?: string[] }>(`/api/pharmacy/rx/${id}`, "POST", body);
    if (r.ok) return (onDone(), onClose());
    setWarn(r.code === "allergy" ? (r.warnings ?? []) : []);
    setMsg(r.message ?? "Gagal.");
  };
  return (
    <Card title={`${d.patient.name} · RM ${d.patient.rmNo ?? "-"}`} right={<button className="text-sm text-muted" onClick={onClose}>Tutup</button>}>
      <p className="mb-3 text-sm">Alergi tercatat: <strong>{d.rx.allergies || "tidak ada"}</strong></p>
      {msg && <p role="alert" className="mb-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">{msg}{warn.length ? ` (${warn.join(", ")})` : ""}</p>}
      <div className="space-y-3">
        {d.rx.lines.map((l) => (
          <div key={l.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_14rem_6rem] sm:items-center">
            <div className="text-sm"><p className="font-medium">{l.drug}</p><p className="text-muted">{l.dose} · {l.freq} · {l.days} hari{l.note ? ` · ${l.note}` : ""}</p></div>
            <Select aria-label={`Item untuk ${l.drug}`} value={pick[l.id]?.itemId ?? ""} onChange={(e) => setPick({ ...pick, [l.id]: { itemId: e.target.value, qty: pick[l.id]?.qty || 1 } })}>
              <option value="">Tidak diserahkan / beli luar</option>
              {items.map((x) => <option key={x.id} value={x.id}>{x.name} (stok {x.usable} {x.unit})</option>)}
            </Select>
            <Input aria-label="Jumlah" type="number" min={0} value={pick[l.id]?.qty ?? 0} disabled={!pick[l.id]?.itemId} onChange={(e) => setPick({ ...pick, [l.id]: { ...pick[l.id], qty: n0(e.target.value) } })} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Pemeriksaan alergi hanya pencocokan kata, bukan pengganti penilaian apoteker. Stok dikurangi dari batch yang paling cepat kedaluwarsa; batch kedaluwarsa tidak diserahkan.</p>
      <div className="mt-4 flex gap-2">
        <button className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg active:scale-[0.97]" onClick={() => submit(false)}>Serahkan obat</button>
        {warn.length > 0 && <button className="min-h-11 rounded-xl border border-amber-400/50 px-5 text-sm" onClick={() => submit(true)}>Sudah saya periksa, lanjutkan</button>}
      </div>
    </Card>
  );
}

function Rx() {
  const [st, setSt] = useState("menunggu");
  const [rows, setRows] = useState<RxRow[] | null>(null);
  const [open, setOpen] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ rx: RxRow[] }>(`/api/pharmacy/rx?status=${st}`);
    setRows(r.ok ? r.rx : []);
  }, [st]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const call = async (id: string) => { await api(`/api/pharmacy/rx/${id}/call`, "POST"); void load(); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
      <a href="/monitor-antrean-farmasi" target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-10">Buka monitor TV farmasi ↗</a>
      </div>
      <Select aria-label="Status resep" value={st} onChange={(e) => (setSt(e.target.value), setOpen(""))} className="max-w-xs"><option value="menunggu">Menunggu</option><option value="selesai">Sudah diserahkan</option></Select>
      {open && <Dispense id={open} onDone={load} onClose={() => setOpen("")} />}
      {!rows ? <Skeleton /> : !rows.length ? <Empty>{st === "menunggu" ? "Tidak ada resep menunggu." : "Belum ada resep diserahkan."}</Empty> : (
        <ul className="glass divide-y divide-line rounded-2xl px-4">
          {rows.map((r) => (
            <li key={r.visitId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>{r.no ? <strong className="mr-1 tabular-nums">#{r.no}</strong> : null}<strong>{r.patientName}</strong> · RM {r.rmNo ?? "-"} · {fmtDate(r.date)} · {r.lines} obat</span>
              {st === "menunggu" && <span className="flex gap-2"><button className="rounded-full border border-line px-4 py-2 text-xs font-medium hover:text-fg active:scale-[0.97]" onClick={() => void call(r.visitId)}>{r.called ? "Panggil ulang" : "Panggil pasien"}</button><button className="rounded-full border border-accent/50 px-4 py-2 text-xs font-medium hover:bg-accent/10" onClick={() => setOpen(r.visitId)}>Proses</button></span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Log() {
  const [m, setM] = useState<{ t: number; name: string; type: string; qty: number; byName?: string; note?: string }[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => void api<{ moves: NonNullable<typeof m> }>("/api/pharmacy/log").then((r) => setM(r.ok ? r.moves : [])), 0);
    return () => clearTimeout(t);
  }, []);
  if (!m) return <Skeleton />;
  if (!m.length) return <Empty>Belum ada mutasi stok.</Empty>;
  const L: Record<string, string> = { restock: "Masuk", dispense: "Keluar (resep)", count: "Opname", create: "Item baru" };
  return <ul className="glass divide-y divide-line rounded-2xl px-4 text-sm">{m.map((x, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2.5"><span>{x.name} · {L[x.type] ?? x.type} {x.qty ? (x.qty > 0 ? `+${x.qty}` : x.qty) : ""}{x.note ? ` · ${x.note}` : ""}</span><span className="text-muted">{x.byName} · {new Date(x.t).toLocaleString("id-ID", { timeZone: "Asia/Makassar", dateStyle: "short", timeStyle: "short" })}</span></li>)}</ul>;
}

export default function Pharmacy({ role }: { role: "superadmin" | "dokter" | "staf" | "apoteker" }) {
  const canRx = role === "superadmin" || role === "apoteker";
  const [tab, setTab] = useState(role === "apoteker" ? "rx" : "stock");
  const tabs: [string, string][] = [...(canRx ? ([["rx", "Resep"]] as [string, string][]) : []), ["stock", "Stok"], ["log", "Riwayat stok"]];
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Farmasi & Stok</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "rx" && canRx && <Rx />}
      {tab === "stock" && <Stock />}
      {tab === "log" && <Log />}
    </div>
  );
}
