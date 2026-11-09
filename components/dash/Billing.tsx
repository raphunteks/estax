"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ConfirmBtn, Empty, Field, Input, Select, Skeleton, Tabs, api, fmtDate } from "./kit";

export const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
type Item = { id: string; name: string; qty: number; price: number };
type Pay = { id: string; amount: number; method: string; at: number; note?: string };
export type Inv = { id: string; no: string; patientName: string; rmNo: string | null; date: string; items: Item[]; discount: number; payments: Pay[]; status: "belum" | "sebagian" | "lunas" | "batal"; total: number; paid: number; due: number; voidReq?: { reason: string }; voidInfo?: { reason: string } };
type Tariff = { id: string; code: string; name: string; price: number; active: boolean };
const ST: Record<string, [string, "ok" | "warn" | "muted" | "bad"]> = { belum: ["Belum dibayar", "warn"], sebagian: ["Dicicil", "warn"], lunas: ["Lunas", "ok"], batal: ["Batal", "bad"] };
export const InvBadge = ({ s }: { s: string }) => <Badge tone={ST[s]?.[1]}>{ST[s]?.[0] ?? s}</Badge>;
const METHODS = ["tunai", "transfer", "qris", "debit", "asuransi", "bpjs"];
const uid = () => Math.random().toString(36).slice(2, 10);

function Detail({ id, isSuper, onChange, onClose }: { id: string; isSuper: boolean; onChange: () => void; onClose: () => void }) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [discount, setDiscount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("tunai");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const [r, t] = await Promise.all([api<{ invoice: Inv }>(`/api/billing/invoices/${id}`), api<{ tariffs: Tariff[] }>("/api/billing/tariffs")]);
    if (r.ok) (setInv(r.invoice), setItems(r.invoice.items), setDiscount(r.invoice.discount), setAmount(r.invoice.due));
    if (t.ok) setTariffs(t.tariffs.filter((x) => x.active));
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const send = async (body: object, ok: string) => {
    const r = await api<{ invoice: Inv }>(`/api/billing/invoices/${id}`, "PATCH", body);
    setMsg(r.ok ? ok : r.message ?? "Gagal.");
    if (r.ok) (setInv(r.invoice), setItems(r.invoice.items), setDiscount(r.invoice.discount), setAmount(r.invoice.due), onChange());
  };
  if (!inv) return <Skeleton />;
  const locked = inv.payments.length > 0 || inv.status === "batal";
  const sub = items.reduce((s, x) => s + x.qty * x.price, 0);
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  return (
    <Card title={`${inv.no} · ${inv.patientName}`} right={<div className="no-print flex gap-2"><button className="rounded-lg border border-line px-3 py-1.5 text-sm" onClick={() => window.print()}>Cetak</button><button className="rounded-lg px-3 py-1.5 text-sm text-muted" onClick={onClose}>Tutup</button></div>}>
      <p className="mb-4 text-sm text-muted">RM {inv.rmNo ?? "-"} · {fmtDate(inv.date)} · <InvBadge s={inv.status} /></p>
      {msg && <p role="status" className="no-print mb-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">{msg}</p>}
      <div className="space-y-2">
        {items.map((x, i) => (
          <div key={x.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[1fr_4.5rem_8rem_auto]">
            <Input aria-label="Nama item" className="col-span-3 sm:col-span-1" value={x.name} disabled={locked} onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <Input aria-label="Jumlah" type="number" min={1} value={x.qty} disabled={locked} onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, qty: Math.max(1, num(e.target.value)) } : y)))} />
            <Input aria-label="Harga" type="number" min={0} value={x.price} disabled={locked} onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, price: num(e.target.value) } : y)))} />
            {!locked && <button aria-label="Hapus item" className="no-print text-sm text-muted hover:text-fg" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted">Belum ada item.</p>}
      </div>
      {!locked && (
        <div className="no-print mt-3 flex flex-wrap items-center gap-2">
          <Select aria-label="Tambah dari tarif" value="" onChange={(e) => { const t = tariffs.find((x) => x.id === e.target.value); if (t) setItems([...items, { id: uid(), name: t.name, qty: 1, price: t.price }]); }} className="max-w-xs">
            <option value="">+ Dari daftar tarif</option>
            {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name} · {rp(t.price)}</option>)}
          </Select>
          <button className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setItems([...items, { id: uid(), name: "", qty: 1, price: 0 }])}>+ Item bebas</button>
          <label className="ml-auto flex items-center gap-2 text-sm">Diskon <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(num(e.target.value))} className="w-32" /></label>
          <button className="rounded-lg bg-accent/20 px-3 py-2 text-sm text-accent" onClick={() => send({ items: items.filter((x) => x.name.trim()), discount }, "Item disimpan.")}>Simpan item</button>
        </div>
      )}
      <dl className="mt-5 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{rp(sub)}</dd></div>
        {discount > 0 && <div className="flex justify-between"><dt>Diskon</dt><dd>-{rp(discount)}</dd></div>}
        <div className="flex justify-between font-medium"><dt>Total</dt><dd>{rp(inv.total)}</dd></div>
        <div className="flex justify-between"><dt>Dibayar</dt><dd>{rp(inv.paid)}</dd></div>
        <div className="flex justify-between font-medium"><dt>Sisa</dt><dd>{rp(inv.due)}</dd></div>
      </dl>
      {inv.payments.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {inv.payments.map((p) => <li key={p.id}>{new Date(p.at).toLocaleString("id-ID", { timeZone: "Asia/Makassar", dateStyle: "medium", timeStyle: "short" })} · {p.method} · {rp(p.amount)}{p.note ? ` · ${p.note}` : ""}</li>)}
        </ul>
      )}
      {inv.status !== "batal" && inv.status !== "lunas" && (
        <div className="no-print mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Nominal bayar"><Input type="number" min={1} value={amount} onChange={(e) => setAmount(num(e.target.value))} /></Field>
          <Field label="Metode"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Catatan"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></Field>
          <button className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg active:scale-[0.97]" onClick={() => send({ pay: { amount, method, note: note || undefined } }, "Pembayaran dicatat.")}>Catat bayar</button>
        </div>
      )}
      {inv.status !== "batal" && inv.payments.length === 0 && (
        <div className="no-print mt-4 flex flex-wrap items-center gap-2 text-sm">
          {inv.voidReq && <Badge tone="warn">Menunggu persetujuan batal: {inv.voidReq.reason}</Badge>}
          {isSuper && inv.voidReq ? (
            <>
              <ConfirmBtn danger label="Setujui batal" onConfirm={() => send({ voidDecide: "approve" }, "Invoice dibatalkan.")} />
              <ConfirmBtn label="Tolak" onConfirm={() => send({ voidDecide: "reject" }, "Permintaan ditolak.")} />
            </>
          ) : !inv.voidReq && (
            <>
              <Input aria-label="Alasan pembatalan" placeholder="Alasan pembatalan" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-xs" />
              <button disabled={reason.trim().length < 3} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40" onClick={() => send(isSuper ? { voidNow: { reason } } : { voidRequest: { reason } }, isSuper ? "Invoice dibatalkan." : "Permintaan dikirim ke superadmin.")}>{isSuper ? "Batalkan invoice" : "Ajukan pembatalan"}</button>
            </>
          )}
        </div>
      )}
      {inv.voidInfo && <p className="mt-4 text-sm text-red-300">Dibatalkan: {inv.voidInfo.reason}</p>}
    </Card>
  );
}

function List({ canWrite, isSuper }: { canWrite: boolean; isSuper: boolean }) {
  const [st, setSt] = useState("belum,sebagian");
  const [rows, setRows] = useState<Inv[] | null>(() => {
    const c = api.getCache<{ invoices: Inv[] }>(`/api/billing/invoices?status=belum,sebagian`);
    return c && c.ok ? c.invoices : null;
  });
  const [open, setOpen] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ invoices: Inv[] }>(`/api/billing/invoices?status=${st}`);
    setRows(r.ok ? r.invoices : []);
  }, [st]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-3">
        <Select aria-label="Filter status" value={st} onChange={(e) => (setSt(e.target.value), setOpen(""))} className="max-w-xs">
          <option value="belum,sebagian">Belum lunas</option><option value="lunas">Lunas</option><option value="batal">Batal</option><option value="belum,sebagian,lunas,batal">Semua</option>
        </Select>
      </div>
      {open && canWrite && <Detail id={open} isSuper={isSuper} onChange={load} onClose={() => setOpen("")} />}
      {!rows ? <Skeleton /> : rows.length === 0 ? <Empty>Tidak ada invoice. Invoice dibuat otomatis saat dokter menyelesaikan kunjungan.</Empty> : (
        <div className="no-print overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="p-3">No.</th><th>Pasien</th><th>Tanggal</th><th className="text-right">Total</th><th className="text-right">Sisa</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="p-3"><button className="underline underline-offset-4" onClick={() => setOpen(i.id)}>{i.no}</button></td>
                  <td>{i.patientName}</td><td>{fmtDate(i.date)}</td><td className="text-right">{rp(i.total)}</td><td className="text-right">{rp(i.due)}</td><td className="p-3"><InvBadge s={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tariffs() {
  const [rows, setRows] = useState<Tariff[] | null>(null);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const t = setTimeout(() => void api<{ tariffs: Tariff[]; canEdit: boolean }>("/api/billing/tariffs").then((r) => (setRows(r.ok ? r.tariffs : []), setEdit(Boolean(r.ok && r.canEdit)))), 0);
    return () => clearTimeout(t);
  }, []);
  if (!rows) return <Skeleton />;
  const up = (i: number, p: Partial<Tariff>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
  const save = async () => {
    const seen = new Set<string>();
    const list = rows.filter((t) => t.name.trim()).map((t) => { let id = t.id || slug(t.name) || uid(); while (seen.has(id)) id = `${id}-${uid().slice(0, 3)}`; seen.add(id); return { ...t, id: id.length < 2 ? `t-${id}` : id, name: t.name.trim() }; });
    const r = await api("/api/billing/tariffs", "PUT", list);
    setMsg(r.ok ? "Tarif disimpan." : r.message ?? "Gagal menyimpan.");
    if (r.ok) setRows(list);
  };
  return (
    <Card title="Tarif tindakan" right={edit ? <button className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-bg" onClick={save}>Simpan</button> : <Badge>Hanya superadmin yang mengubah</Badge>}>
      {msg && <p role="status" className="mb-3 text-sm">{msg}</p>}
      <p className="mb-3 text-xs text-muted">Nama tarif yang sama dengan nama tindakan di pemeriksaan otomatis terisi harganya di invoice.</p>
      <div className="space-y-2">
        {rows.map((t, i) => (
          <div key={t.id || i} className="grid grid-cols-[5rem_1fr_8rem_auto] items-center gap-2">
            <Input aria-label="Kode" placeholder="Kode" value={t.code} disabled={!edit} onChange={(e) => up(i, { code: e.target.value })} />
            <Input aria-label="Nama" placeholder="Nama tindakan" value={t.name} disabled={!edit} onChange={(e) => up(i, { name: e.target.value })} />
            <Input aria-label="Harga" type="number" min={0} value={t.price} disabled={!edit} onChange={(e) => up(i, { price: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
            {edit && <button aria-label="Hapus tarif" className="text-sm text-muted hover:text-fg" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {!rows.length && <Empty>Belum ada tarif.</Empty>}
      </div>
      {edit && <button className="mt-3 rounded-full border border-line px-4 py-2 text-sm" onClick={() => setRows([...rows, { id: "", code: "", name: "", price: 0, active: true }])}>Tambah tarif</button>}
    </Card>
  );
}

function Report() {
  const [d, setD] = useState<{ received: number; outstanding: number; invoices: number; byMethod: Record<string, number>; byDay: Record<string, number>; from: string; to: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => void api<NonNullable<typeof d>>("/api/billing/report").then((r) => r.ok && setD(r as unknown as NonNullable<typeof d>)), 0);
    return () => clearTimeout(t);
  }, []);
  if (!d) return <Skeleton />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Diterima (30 hari)", rp(d.received)], ["Piutang berjalan", rp(d.outstanding)], ["Invoice", String(d.invoices)]].map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-4"><p className="text-sm text-muted">{k}</p><p className="display text-2xl">{v}</p></div>
        ))}
      </div>
      <Card title="Per metode bayar">
        {Object.keys(d.byMethod).length ? <ul className="space-y-1 text-sm">{Object.entries(d.byMethod).map(([m, v]) => <li key={m} className="flex justify-between"><span>{m}</span><span>{rp(v)}</span></li>)}</ul> : <Empty>Belum ada pembayaran pada periode ini.</Empty>}
      </Card>
    </div>
  );
}

export default function Billing({ role }: { role: "superadmin" | "dokter" | "staf" | "apoteker" }) {
  const canWrite = role === "superadmin" || role === "staf";
  const [tab, setTab] = useState("inv");
  const tabs: [string, string][] = [["inv", "Invoice"], ["tar", "Tarif tindakan"], ...(canWrite ? ([["rep", "Laporan"]] as [string, string][]) : [])];
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Kasir</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "inv" && <List canWrite={canWrite} isSuper={role === "superadmin"} />}
      {tab === "tar" && <Tariffs />}
      {tab === "rep" && <Report />}
    </div>
  );
}
