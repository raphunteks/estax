"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Select, Input, api, fmtDate } from "./kit";

type Cs = { id: string; title: string; status: string; signed: boolean };
type Tpl = { id: string; title: string; active: boolean };
type Art = { id: string; title: string; active: boolean };
type Feat = { recall: { id: string; name: string; days: number }[] };
type PF = { id: string; label: string; kind: string };

/** Doctor tools inside an exam: request consent, send education, set the control/recall date, view patient uploads. */
export default function ExamCare({ visitId, patientId, role, recall, locked, onRecall }: { visitId: string; patientId: string; role: string; recall?: { name: string; date: string; note?: string } | null; locked: boolean; onRecall: (r: { name: string; date: string } | null) => void }) {
  const doctor = role === "dokter" || role === "superadmin";
  const [cs, setCs] = useState<Cs[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [edu, setEdu] = useState<Art[]>([]);
  const [feat, setFeat] = useState<Feat | null>(null);
  const [files, setFiles] = useState<PF[]>([]);
  const [tpl, setTpl] = useState("");
  const [art, setArt] = useState("");
  const [rc, setRc] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const loadC = useCallback(() => void api<{ consents: Cs[] }>(`/api/consents?visitId=${visitId}`).then((r) => r.ok && setCs(r.consents)), [visitId]);
  useEffect(() => {
    const t = setTimeout(() => {
      loadC();
      void api<{ data: Tpl[] }>("/api/master/consent").then((r) => r.ok && setTpls(r.data.filter((x) => x.active)));
      void api<{ data: Art[] }>("/api/master/edu").then((r) => r.ok && setEdu(r.data.filter((x) => x.active)));
      void api<{ data: Feat }>("/api/master/features").then((r) => r.ok && setFeat(r.data));
      void api<{ files: PF[] }>(`/api/patients/${patientId}/berkas`).then((r) => r.ok && setFiles(r.files));
    }, 0);
    return () => clearTimeout(t);
  }, [loadC, patientId]);
  const ask = async () => { const r = await api("/api/consents", "POST", { visitId, tplId: tpl }); setMsg(r.ok ? "Permintaan tanda tangan dikirim ke pasien." : r.message ?? "Gagal."); if (r.ok) loadC(); };
  const sendEdu = async () => { const r = await api<{ message: string }>("/api/edu/send", "POST", { visitId, eduId: art }); setMsg(r.ok ? r.message : r.message ?? "Gagal."); };
  const setRecall = async () => {
    const p = feat?.recall.find((x) => x.id === rc);
    if (!p) return;
    const r = await api<{ recall?: { name: string; date: string } }>(`/api/visits/${visitId}`, "PATCH", { recall: { name: p.name, days: p.days, note: note || undefined } });
    setMsg(r.ok ? "Jadwal kontrol disimpan." : r.message ?? "Gagal."); if (r.ok) { const d = new Date(Date.now() + 8 * 3600e3); d.setUTCDate(d.getUTCDate() + p.days); onRecall({ name: p.name, date: d.toISOString().slice(0, 10) }); }
  };
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card title="Persetujuan tindakan">
        <ul className="mb-3 space-y-1 text-sm">{cs.length === 0 && <li className="text-muted">Belum ada permintaan.</li>}{cs.map((c) => <li key={c.id} className="flex justify-between gap-2"><span>{c.title}</span><Badge tone={c.status === "ditandatangani" ? "ok" : c.status === "menunggu" ? "warn" : "bad"}>{c.status}</Badge></li>)}</ul>
        {doctor && !locked && <div className="flex gap-2"><Select aria-label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Pilih formulir…</option>{tpls.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select><button className="btn btn-primary min-h-11 shrink-0" disabled={!tpl} onClick={() => void ask()}>Minta tanda tangan</button></div>}
      </Card>
      <Card title="Edukasi & kontrol">
        <div className="flex gap-2"><Select aria-label="Materi" value={art} onChange={(e) => setArt(e.target.value)}><option value="">Kirim materi edukasi…</option>{edu.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select><button className="btn btn-ghost min-h-11 shrink-0" disabled={!art} onClick={() => void sendEdu()}>Kirim</button></div>
        {doctor && (
          <div className="mt-4">
            <p className="mb-1 text-sm">{recall ? <>Kontrol: <strong>{recall.name}</strong> · {fmtDate(recall.date)}</> : "Belum ada jadwal kontrol."}</p>
            {!locked && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select aria-label="Preset kontrol" value={rc} onChange={(e) => setRc(e.target.value)}><option value="">Pilih jadwal kontrol…</option>{feat?.recall.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.days} hari)</option>)}</Select><Input aria-label="Catatan" placeholder="Catatan (opsional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn btn-ghost min-h-11" disabled={!rc} onClick={() => void setRecall()}>Simpan</button></div>}
          </div>
        )}
      </Card>
      {files.length > 0 && (
        <Card title="Foto & rontgen dari pasien"><ul className="grid grid-cols-3 gap-2">{files.map((f) => <li key={f.id}><Link href={`/api/files/doc/${f.id}`} target="_blank" className="block"><span className="sr-only">{f.label}</span>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/files/doc/${f.id}`} alt={f.label} className="h-24 w-full rounded-lg object-cover" /><span className="text-xs text-muted">{f.label}</span></Link></li>)}</ul></Card>
      )}
      <p role="status" className="text-sm text-muted lg:col-span-2">{msg}</p>
    </div>
  );
}
