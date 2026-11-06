"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, ConfirmBtn, Empty, Field, Input, Select, Skeleton, api, fmtDate } from "./kit";
import Signature from "./Signature";

const day = (t: number) => fmtDate(new Date(t + 8 * 3600e3).toISOString().slice(0, 10));
const Msg = ({ m }: { m: string }) => <p role="status" className="mt-2 text-sm text-muted">{m}</p>;
function useLoad<T>(url: string, pick: (r: never) => T) {
  const [v, setV] = useState<T | null>(null);
  const load = useCallback(() => void api(url).then((r) => setV(r.ok ? pick(r as never) : null)), [url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  return [v, load] as const;
}

/* ---- Informed consent ---- */
type C = { id: string; title: string; body: string; status: string; createdAt: number; signedAt?: number; patientName: string; doctor?: string; signature?: string };
function Consent() {
  const [rows, load] = useLoad<C[]>("/api/portal/persetujuan", (r: { consents: C[] }) => r.consents);
  const [open, setOpen] = useState("");
  const [sig, setSig] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async (id: string, action: "sign" | "decline") => {
    const r = await api(`/api/portal/persetujuan/${id}`, "POST", action === "sign" ? { action, signature: sig, signerName: name, agree } : { action });
    setMsg(r.ok ? "Tersimpan." : r.message ?? "Gagal."); if (r.ok) { setOpen(""); setSig(""); load(); }
  };
  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty>Belum ada formulir persetujuan. Dokter akan mengirimkannya saat diperlukan.</Empty>;
  return (
    <ul className="space-y-3">
      {rows.map((c) => (
        <li key={c.id} className="glass rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{c.title}</p><p className="text-xs text-muted">{c.patientName} · {c.doctor} · {day(c.createdAt)}</p></div>
            <Badge tone={c.status === "ditandatangani" ? "ok" : c.status === "menunggu" ? "warn" : "bad"}>{c.status === "menunggu" ? "Menunggu tanda tangan" : c.status === "ditandatangani" ? "Ditandatangani" : "Ditolak"}</Badge></div>
          <details className="mt-2" open={open === c.id}><summary onClick={() => setOpen(open === c.id ? "" : c.id)} className="cursor-pointer text-sm text-accent">Baca isi</summary><p className="mt-2 whitespace-pre-line text-sm text-muted">{c.body}</p></details>
          {c.status === "menunggu" && open === c.id && (
            <div className="mt-3 space-y-3">
              <Field label="Nama penanda tangan (pasien atau wali)"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
              <Signature onChange={setSig} />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />Saya sudah membaca, memahami, dan menyetujui tindakan di atas.</label>
              <div className="flex gap-2"><button className="btn btn-primary min-h-11" disabled={!sig || name.trim().length < 2 || !agree} onClick={() => void send(c.id, "sign")}>Tanda tangani</button><ConfirmBtn label="Tolak" danger onConfirm={() => void send(c.id, "decline")} /></div>
            </div>
          )}
          {c.signature && <Image src={c.signature} alt="Tanda tangan" width={160} height={56} unoptimized className="mt-2 h-14 w-auto rounded border border-line bg-white" />}
        </li>
      ))}
      <Msg m={msg} />
    </ul>
  );
}

/* ---- Medication schedule ---- */
type RxI = { visitId: string; date: string; status: string; lines: { id: string; drug: string; dose: string; freq: string; days: string; note?: string; times: string[]; total: number; day: number; active: boolean }[] };
function Meds() {
  const [rows] = useLoad<RxI[]>("/api/portal/obat", (r: { items: RxI[] }) => r.items);
  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty>Belum ada resep.</Empty>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.visitId} className="glass rounded-2xl p-5">
          <div className="flex justify-between"><p className="font-medium">Resep {fmtDate(r.date)}</p><Badge tone={r.status === "selesai" ? "ok" : "warn"}>{r.status === "selesai" ? "Obat diserahkan" : "Menunggu farmasi"}</Badge></div>
          <ul className="mt-3 divide-y divide-line">
            {r.lines.map((l) => (
              <li key={l.id} className="py-2 text-sm"><p className="font-medium">{l.drug} <span className="font-normal text-muted">· {l.dose}</span></p>
                <p className="text-muted">{l.freq} · {l.days} hari{l.active ? ` · hari ke-${l.day} dari ${l.total}` : l.total && l.day > l.total ? " · selesai" : ""}</p>
                {l.times.length > 0 && <p className="text-xs text-accent">Jam minum: {l.times.join(", ")} WITA</p>}{l.note && <p className="text-xs text-muted">{l.note}</p>}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/* ---- Education ---- */
function Edu() {
  const [rows] = useLoad<{ id: string; title: string; body: string; t: number }[]>("/api/portal/edukasi", (r: { items: never[] }) => r.items);
  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty>Belum ada materi. Panduan perawatan akan muncul setelah kunjungan Anda.</Empty>;
  return <ul className="space-y-3">{rows.map((e) => <li key={e.id + e.t} className="glass rounded-2xl p-5"><p className="font-medium">{e.title}</p><p className="text-xs text-muted">{day(e.t)}</p><p className="mt-2 whitespace-pre-line text-sm text-muted">{e.body}</p></li>)}</ul>;
}

/* ---- Photos / x-rays ---- */
type F = { id: string; patientId: string; label: string; kind: string; t: number };
type Mem = { id: string; name: string };
function Files() {
  const [files, load] = useLoad<F[]>("/api/portal/berkas", (r: { files: F[] }) => r.files);
  const [mem] = useLoad<Mem[]>("/api/portal/keluarga", (r: { members: Mem[] }) => r.members);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const up = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await fetch("/api/portal/berkas", { method: "POST", body: new FormData(form.current!) }).then((x) => x.json()).catch(() => ({ ok: false, message: "Koneksi bermasalah." }));
    setMsg(r.ok ? "Terunggah." : r.message ?? "Gagal."); setBusy(false); if (r.ok) { form.current?.reset(); load(); }
  };
  return (
    <div className="space-y-4">
      <Card title="Unggah foto atau rontgen sebelumnya">
        <form ref={form} onSubmit={up} className="grid gap-3 sm:grid-cols-2">
          <Field label="Untuk"><Select name="patientId" required>{(mem ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
          <Field label="Jenis"><Select name="kind"><option value="rontgen">Rontgen</option><option value="foto">Foto gigi</option><option value="lain">Lainnya</option></Select></Field>
          <Field label="Keterangan"><Input name="label" maxLength={80} placeholder="mis. Panoramik 2025" /></Field>
          <Field label="Berkas (JPG/PNG/WebP, maks 6 MB)"><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" /></Field>
          <div><button className="btn btn-primary min-h-11" disabled={busy}>{busy ? "Mengunggah…" : "Unggah"}</button></div>
        </form><Msg m={msg} />
      </Card>
      {!files ? <Skeleton /> : files.length === 0 ? <Empty>Belum ada berkas.</Empty> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f) => (
            <li key={f.id} className="glass overflow-hidden rounded-2xl">
              <Image src={`/api/files/doc/${f.id}`} alt={f.label} width={400} height={300} unoptimized className="h-36 w-full object-cover" />
              <div className="p-3 text-xs"><p className="font-medium">{f.label}</p><p className="text-muted">{day(f.t)}</p><ConfirmBtn label="Hapus" danger onConfirm={() => void api(`/api/portal/berkas?id=${f.id}`, "DELETE").then(load)} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---- Family ---- */
type M = { id: string; name: string; relation?: string; rmNo: string | null; birthDate: string; self: boolean };
function Family() {
  const [rows, load] = useLoad<M[]>("/api/portal/keluarga", (r: { members: M[] }) => r.members);
  const [f, setF] = useState({ name: "", birthDate: "", relation: "anak", gender: "L" });
  const [msg, setMsg] = useState("");
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/portal/keluarga", "POST", f);
    setMsg(r.ok ? "Anggota ditambahkan." : r.message ?? "Gagal."); if (r.ok) { setF({ ...f, name: "" }); load(); }
  };
  return (
    <div className="space-y-4">
      {!rows ? <Skeleton /> : <ul className="space-y-2">{rows.map((m) => (
        <li key={m.id} className="glass flex items-center justify-between gap-3 rounded-2xl p-4 text-sm"><div><p className="font-medium">{m.name}{m.self && " (saya)"}</p><p className="text-xs text-muted">{m.relation ?? ""} · {fmtDate(m.birthDate)} · RM {m.rmNo ?? "belum terbit"}</p></div>
          {!m.self && <ConfirmBtn label="Hapus" danger onConfirm={() => void api(`/api/portal/keluarga?id=${m.id}`, "DELETE").then(load)} />}</li>))}</ul>}
      <Card title="Tambah anggota keluarga">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama lengkap"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={80} /></Field>
          <Field label="Tanggal lahir"><Input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} required /></Field>
          <Field label="Hubungan"><Select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>{["anak", "pasangan", "orang tua", "saudara", "lainnya"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Jenis kelamin"><Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="L">Laki-laki</option><option value="P">Perempuan</option></Select></Field>
          <div><button className="btn btn-primary min-h-11">Tambah</button></div>
        </form><Msg m={msg} />
      </Card>
    </div>
  );
}

/* ---- Chat ---- */
type Ms = { id: string; from: string; byName: string; text: string; t: number };
export function ChatBox({ url, send }: { url: string; send: string }) {
  const [msgs, load] = useLoad<Ms[]>(url, (r: { messages: Ms[] }) => r.messages);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (!text.trim()) return; const r = await api(send, "POST", { text }); setErr(r.ok ? "" : r.message ?? "Gagal."); if (r.ok) { setText(""); load(); } };
  return (
    <div className="glass rounded-2xl p-4">
      <div className="max-h-[50vh] min-h-40 space-y-2 overflow-y-auto" aria-live="polite">
        {!msgs ? <Skeleton /> : msgs.length === 0 ? <p className="py-8 text-center text-sm text-muted">Belum ada pesan.</p> : msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === "pasien" ? "justify-end" : ""}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "pasien" ? "bg-accent/15" : "bg-fg/5"}`}><p className="whitespace-pre-wrap">{m.text}</p><p className="mt-0.5 text-[10px] text-muted">{m.byName} · {new Date(m.t + 8 * 3600e3).toISOString().slice(11, 16)}</p></div></div>
        ))}<div ref={end} />
      </div>
      <form onSubmit={go} className="mt-3 flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Tulis pesan…" aria-label="Pesan" /><button className="btn btn-primary min-h-11">Kirim</button></form>
      {err && <Msg m={err} />}
    </div>
  );
}
const Chat = () => (<><p className="mb-3 text-sm text-muted">Untuk pertanyaan singkat. Kondisi darurat: hubungi klinik atau IGD terdekat.</p><ChatBox url="/api/portal/chat" send="/api/portal/chat" /></>);

/* ---- Survey ---- */
function Survey() {
  const [rows, load] = useLoad<{ visitId: string; date: string }[]>("/api/portal/survei", (r: { pending: never[] }) => r.pending);
  const [pick, setPick] = useState<Record<string, { r: number; c: string }>>({});
  const [msg, setMsg] = useState("");
  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty>Tidak ada survei yang menunggu. Terima kasih!</Empty>;
  return (
    <ul className="space-y-3">{rows.map((v) => { const s = pick[v.visitId] ?? { r: 0, c: "" }; return (
      <li key={v.visitId} className="glass rounded-2xl p-5">
        <p className="font-medium">Kunjungan {fmtDate(v.date)}</p>
        <div role="radiogroup" aria-label="Nilai" className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={s.r === n} aria-label={`${n} bintang`} onClick={() => setPick({ ...pick, [v.visitId]: { ...s, r: n } })} className={`size-11 rounded-xl border text-lg transition-transform active:scale-95 ${s.r >= n ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}>★</button>)}</div>
        <Input className="mt-3" value={s.c} onChange={(e) => setPick({ ...pick, [v.visitId]: { ...s, c: e.target.value } })} maxLength={300} placeholder="Saran atau komentar (opsional)" aria-label="Komentar" />
        <button className="btn btn-primary mt-3 min-h-11" disabled={!s.r} onClick={() => void api("/api/portal/survei", "POST", { visitId: v.visitId, rating: s.r, comment: s.c || undefined }).then((r) => { setMsg(r.ok ? "Terima kasih atas penilaian Anda." : r.message ?? "Gagal."); if (r.ok) load(); })}>Kirim</button>
      </li>); })}<Msg m={msg} /></ul>
  );
}

export const VIEWS = { persetujuan: ["Persetujuan tindakan", Consent], obat: ["Obat & jadwal minum", Meds], edukasi: ["Edukasi perawatan", Edu], berkas: ["Foto & rontgen", Files], keluarga: ["Keluarga", Family], pesan: ["Pesan ke klinik", Chat], survei: ["Survei kepuasan", Survey] } as const;
export default function PortalServices({ kind }: { kind: keyof typeof VIEWS }) {
  const [title, View] = VIEWS[kind];
  return <div><h1 className="display mb-6 text-3xl">{title}</h1><View /></div>;
}
