"use client";

import { useState } from "react";
import { api } from "./kit";

const area = "w-full rounded-xl border border-line bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function PortalFaq() {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ask = async () => {
    const question = q.trim();
    if (question.length < 2) return;
    setBusy(true); setErr("");
    const r = await api<{ text: string }>("/api/ai/faq", "POST", { question });
    setBusy(false);
    if (!r.ok) return setErr(r.message ?? "Asisten sedang tidak tersedia.");
    setLog((l) => [{ q: question, a: r.text }, ...l]); setQ("");
  };
  return (
    <div className="max-w-2xl">
      <h1 className="display mb-2 text-3xl">Tanya Estaka</h1>
      <p className="mb-5 text-sm text-muted">Pertanyaan umum soal layanan, jam praktik, dan biaya. Asisten ini tidak memberi diagnosis dan tidak melihat data medis Anda. Untuk keluhan, hubungi klinik.</p>
      <label htmlFor="faq-q" className="mb-1 block text-sm">Pertanyaan Anda</label>
      <textarea id="faq-q" className={area} rows={3} maxLength={500} value={q} onChange={(e) => setQ(e.target.value)} />
      <button disabled={busy || q.trim().length < 2} onClick={ask} className="mt-3 min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg disabled:opacity-40">{busy ? "Memproses…" : "Kirim"}</button>
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
      <ul className="mt-6 space-y-4" aria-live="polite">{log.map((m, i) => <li key={i} className="rounded-xl border border-line p-4"><p className="text-xs text-muted">{m.q}</p><p className="mt-2 whitespace-pre-wrap text-sm">{m.a}</p></li>)}</ul>
    </div>
  );
}
