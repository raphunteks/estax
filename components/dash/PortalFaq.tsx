"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { api } from "./kit";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "estaka.tanya.v1";
const SUGGEST = ["Jam praktik klinik?", "Layanan apa saja yang tersedia?", "Bagaimana cara membuat janji?", "Apakah perawatan saluran akar sakit?"];

/** One-on-one chat with the clinic's AI assistant (9Router via /api/ai/faq). The conversation stays in this tab only (sessionStorage). */
export default function PortalFaq() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try { const raw = sessionStorage.getItem(KEY); if (raw) setMsgs(JSON.parse(raw) as Msg[]); } catch {}
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (loaded.current) try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))); } catch {}
    end.current?.scrollIntoView({ block: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (question.length < 2 || busy) return;
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: question }]); setQ(""); setBusy(true); setErr("");
    const r = await api<{ text: string }>("/api/ai/faq", "POST", { question, history });
    setBusy(false);
    if (!r.ok || !r.text) return setErr(r.message ?? "Asisten sedang tidak tersedia. Coba lagi sebentar.");
    setMsgs((m) => [...m, { role: "assistant", content: r.text }]);
  }
  const reset = () => { setMsgs([]); setErr(""); try { sessionStorage.removeItem(KEY); } catch {} };

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Sparkles size={22} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="display text-2xl leading-tight">Asisten Estaka</h1>
          <p className="text-xs text-muted">Informasi layanan, jam praktik, dan biaya umum</p>
        </div>
        {msgs.length > 0 && <button onClick={reset} aria-label="Mulai percakapan baru" className="grid size-10 place-items-center rounded-full border border-line text-muted transition-transform active:scale-95"><RotateCcw size={16} aria-hidden="true" /></button>}
      </header>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-bg">
            <Phone size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">Mode Panggilan Suara / Telepon AI</p>
            <p className="text-[11px] text-muted">Bicara langsung dua arah dengan AI tanpa mengetik</p>
          </div>
        </div>
        <Link
          href="/portal/bicara"
          className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-bg transition-transform active:scale-95"
        >
          Bicara Suara
        </Link>
      </div>

      <p className="mt-3 rounded-xl border border-line px-3 py-2 text-xs text-muted">Dijawab oleh AI dan bisa keliru. Tidak memberi diagnosis dan tidak melihat data medis Anda. Untuk keluhan, hubungi klinik.</p>

      <ul className="mt-4 min-h-[40dvh] space-y-3" aria-live="polite" aria-label="Percakapan">
        {msgs.length === 0 && !busy && (
          <li className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">
            Halo! Silakan tanyakan seputar Estaka Dental Clinic.
            <span className="mt-3 flex flex-wrap justify-center gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => void send(s)} className="min-h-9 rounded-full border border-line px-3 text-xs text-fg transition-transform active:scale-95">{s}</button>)}</span>
          </li>
        )}
        {msgs.map((m, i) => (
          <li key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-md bg-accent text-bg" : "rounded-bl-md border border-line bg-card"}`}>{m.content}</p>
          </li>
        ))}
        {busy && <li className="flex justify-start" aria-label="Asisten sedang mengetik"><span className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3">{[0, 1, 2].map((n) => <span key={n} className="size-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${n * 160}ms` }} />)}</span></li>}
        <div ref={end} />
      </ul>
      {err && (
        <p role="alert" className="mt-3 rounded-xl border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-sm">
          {err} <button className="underline" onClick={() => { const last = [...msgs].reverse().find((m) => m.role === "user"); if (last) { setMsgs((m) => m.slice(0, -1)); void send(last.content); } }}>Coba lagi</button>
        </p>
      )}

      <form toolname="ask_ai_assistant" tooldescription="Kirim pertanyaan seputar layanan, jadwal, atau biaya ke Asisten AI Estaka Dental Clinic." onSubmit={(e) => { e.preventDefault(); void send(q); }} className="sticky bottom-24 mt-4 flex items-end gap-2 rounded-2xl border border-line bg-bg p-2 shadow-lg md:bottom-4">
        <label htmlFor="faq-q" className="sr-only">Pertanyaan Anda</label>
        <textarea
          id="faq-q" name="question" toolparamdescription="Pertanyaan Anda mengenai layanan, jadwal dokter, atau estimasi biaya." rows={1} maxLength={500} value={q} placeholder="Tulis pertanyaan Anda…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(q); } }}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none"
        />
        <button type="submit" disabled={busy || q.trim().length < 2} aria-label="Kirim" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-bg transition-transform active:scale-95 disabled:opacity-40"><SendHorizontal size={18} aria-hidden="true" /></button>
      </form>
    </div>
  );
}
