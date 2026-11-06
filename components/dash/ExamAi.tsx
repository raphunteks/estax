"use client";

import { useState } from "react";
import { Card, api } from "./kit";
import { useDictate } from "./useDictate";

type Soap = { s?: string; o?: string; a?: string; p?: string };
type Check = { ok: boolean; label: string };
const area = "w-full rounded-xl border border-line bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const btn = "min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-40";
const LABEL: Record<keyof Soap, string> = { s: "Subjective", o: "Objective", a: "Assessment", p: "Plan" };

/** AI helpers inside the exam: dictation to SOAP, history digest, completeness check (no AI) and aftercare message. Drafts only. */
export default function ExamAi({ visitId, patientId, canEdit, reason, checks, onApply }: { visitId: string; patientId: string; canEdit: boolean; reason?: string; checks: Check[]; onApply: (s: Soap) => void }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Soap | null>(null);
  const [sum, setSum] = useState("");
  const [edu, setEdu] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const dict = useDictate((t) => setText((x) => (x ? `${x}\n` : "") + t));

  const run = async <T,>(key: string, tool: string, body: object, ok: (r: T) => void) => {
    setBusy(key); setErr("");
    const r = await api<T>(`/api/ai/${tool}`, "POST", body);
    setBusy("");
    if (r.ok) ok(r as unknown as T); else setErr(r.message ?? "AI gagal.");
  };
  const missing = checks.filter((c) => !c.ok);

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
      <Card title="Dikte ke SOAP (AI)">
        <label htmlFor="exam-ai-note" className="mb-1 block text-sm">Catatan atau dikte</label>
        <textarea id="exam-ai-note" name="exam-ai-note" className={area} rows={5} maxLength={4000} value={text} disabled={!canEdit} onChange={(e) => setText(e.target.value)} placeholder="Contoh: karies dalam gigi 36, perkusi positif, rencana PSA minggu depan" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={`${btn} ${dict.rec ? "border-red-400 text-red-300" : ""}`} disabled={!canEdit || dict.busy} aria-pressed={dict.rec} onClick={dict.toggle}>{dict.rec ? "■ Berhenti" : dict.busy ? "Mengubah suara…" : "● Dikte"}</button>
          <button type="button" className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg disabled:opacity-40" disabled={!canEdit || busy === "soap" || text.trim().length < 2} onClick={() => run<{ soap?: Soap }>("soap", "soap", { text, patientId }, (r) => r.soap && setDraft(r.soap))}>{busy === "soap" ? "Memproses…" : "Susun jadi SOAP"}</button>
        </div>
        {draft && (
          <div className="mt-4 space-y-2 rounded-xl border border-line p-3 text-sm">
            {(Object.keys(LABEL) as (keyof Soap)[]).filter((k) => draft[k]).map((k) => <p key={k}><strong>{LABEL[k]}:</strong> {draft[k]}</p>)}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-bg" onClick={() => { onApply(draft); setDraft(null); setText(""); }}>Tambahkan ke SOAP</button>
              <span className="text-xs text-muted">Draf AI. Periksa sebelum dipakai; tidak membuat diagnosis atau resep.</span>
            </div>
          </div>
        )}
        {(err || dict.err) && <p role="alert" className="mt-3 text-sm text-red-300">{err || dict.err}</p>}
      </Card>

      <div className="space-y-4">
        <Card title="Kelengkapan catatan">
          <ul className="space-y-1.5 text-sm">
            {checks.map((c) => <li key={c.label} className="flex items-center gap-2"><span aria-hidden="true" className={c.ok ? "text-accent" : "font-bold text-amber-500"}>{c.ok ? "✓" : "!"}</span><span>{c.label}</span></li>)}
          </ul>
          <p className="mt-3 text-xs text-muted">{missing.length ? `${missing.length} butir belum terisi sebelum kunjungan diselesaikan.` : "Semua butir utama sudah terisi."}</p>
        </Card>
        <Card title="Alat bantu lain">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy === "sum"} onClick={() => run<{ text?: string }>("sum", "summary", { patientId, reason }, (r) => setSum(r.text ?? ""))}>{busy === "sum" ? "Merangkum…" : "Ringkas riwayat pasien"}</button>
            <button type="button" className={btn} disabled={busy === "edu"} onClick={() => run<{ text?: string }>("edu", "edu", { visitId, reason }, (r) => setEdu(r.text ?? ""))}>{busy === "edu" ? "Menyusun…" : "Pesan pasca perawatan"}</button>
          </div>
          {sum && <p className="mt-3 whitespace-pre-wrap rounded-xl border border-line p-3 text-sm">{sum}</p>}
          {edu && (
            <div className="mt-3 rounded-xl border border-line p-3">
              <p className="whitespace-pre-wrap text-sm">{edu}</p>
              <button type="button" className="mt-2 rounded-full border border-line px-4 py-1.5 text-xs" onClick={() => { void navigator.clipboard?.writeText(edu); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Tersalin" : "Salin untuk WhatsApp"}</button>
            </div>
          )}
          {(sum || edu) && <p className="mt-2 text-xs text-muted">Draf AI. Periksa dan koreksi sebelum dipakai.</p>}
        </Card>
      </div>
    </div>
  );
}
