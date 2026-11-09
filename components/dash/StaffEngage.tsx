"use client";

import { useCallback, useEffect, useState } from "react";
import { peek, remember, useOnLive } from "@/lib/live";
import { Badge, Empty, Skeleton, api, fmtDate } from "./kit";
import { ChatBox } from "./PortalServices";

type T = { patientId: string; name: string; rmNo: string | null; last: { t: number; text: string }; unread: boolean };
export function StaffChat() {
  const [th, setTh] = useState<T[] | null>(() => peek<T[]>("staff-chat"));
  const [sel, setSel] = useState("");
  const load = useCallback(() => void api<{ threads: T[] }>("/api/chat").then((r) => { const next = r.ok ? r.threads : []; remember("staff-chat", next); setTh(next); }), []);
  useOnLive(load, 60000);
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Pesan pasien</h1>
      {!th ? <Skeleton /> : th.length === 0 ? <Empty>Belum ada pesan masuk.</Empty> : (
        <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
          <ul className="space-y-2">{th.map((t) => (
            <li key={t.patientId}><button onClick={() => { setSel(t.patientId); setTimeout(load, 800); }} aria-current={sel === t.patientId} className={`w-full rounded-2xl border p-3 text-left transition-transform active:scale-[0.98] ${sel === t.patientId ? "border-accent bg-accent/10" : "border-line"}`}>
              <span className="flex items-center justify-between gap-2 text-sm font-medium">{t.name}{t.unread && <Badge tone="warn">Baru</Badge>}</span>
              <span className="block truncate text-xs text-muted">RM {t.rmNo ?? "-"} · {t.last.text}</span></button></li>))}</ul>
          {sel ? <ChatBox key={sel} url={`/api/chat/${sel}`} send={`/api/chat/${sel}`} /> : <Empty>Pilih percakapan.</Empty>}
        </div>
      )}
    </div>
  );
}

type S = { count: number; avg: number; dist: number[]; rows: { id: string; rating: number; comment?: string; t: number; doctor?: string }[] };
export function StaffSurvey() {
  const [d, setD] = useState<S | null>(() => (api.getCache<S>("/api/survey") as unknown as S) ?? null);
  useEffect(() => void api<S>("/api/survey").then((r) => setD(r.ok ? r : null)), []);
  if (!d) return <Skeleton />;
  const max = Math.max(1, ...d.dist);
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Survei kepuasan</h1>
      <div className="glass mb-4 grid gap-4 rounded-2xl p-5 sm:grid-cols-[10rem_1fr]">
        <div><p className="display text-5xl text-accent">{d.avg || "-"}</p><p className="text-xs text-muted">dari 5 · {d.count} respons</p></div>
        <ul className="space-y-1" aria-label="Sebaran nilai">{[5, 4, 3, 2, 1].map((n) => <li key={n} className="flex items-center gap-2 text-xs"><span className="w-6">{n}★</span><span className="h-2 rounded bg-accent" style={{ width: `${(d.dist[n - 1] / max) * 100}%`, minWidth: d.dist[n - 1] ? 4 : 0 }} /><span className="text-muted">{d.dist[n - 1]}</span></li>)}</ul>
      </div>
      {d.rows.length === 0 ? <Empty>Belum ada respons.</Empty> : <ul className="space-y-2">{d.rows.filter((r) => r.comment).map((r) => <li key={r.id} className="glass rounded-2xl p-4 text-sm"><p>{"★".repeat(r.rating)} <span className="text-xs text-muted">· {r.doctor} · {fmtDate(new Date(r.t + 8 * 3600e3).toISOString().slice(0, 10))}</span></p><p className="mt-1 text-muted">{r.comment}</p></li>)}</ul>}
    </div>
  );
}

type R = { visitId: string; patientName: string; rmNo: string | null; name: string; date: string; note?: string; remindedAt?: number; overdue: boolean };
export function StaffRecall() {
  const [rows, setRows] = useState<R[] | null>(() => api.getCache<{ rows: R[] }>("/api/recall")?.rows ?? null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => void api<{ rows: R[] }>("/api/recall").then((r) => setRows(r.ok ? r.rows : [])), []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Kontrol & recall</h1>
      {!rows ? <Skeleton /> : rows.length === 0 ? <Empty>Tidak ada kontrol yang menunggu. Dokter menjadwalkan kontrol dari halaman pemeriksaan.</Empty> : (
        <ul className="space-y-2">{rows.map((r) => (
          <li key={r.visitId} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm">
            <div><p className="font-medium">{r.patientName} <span className="text-xs text-muted">RM {r.rmNo ?? "-"}</span></p><p className="text-muted">{r.name} · {fmtDate(r.date)}{r.note ? ` · ${r.note}` : ""}</p></div>
            <div className="flex items-center gap-2">{r.overdue && <Badge tone="bad">Terlambat</Badge>}{r.remindedAt && <Badge tone="ok">Sudah diingatkan</Badge>}
              <button className="btn btn-ghost min-h-10" onClick={() => void api(`/api/recall/${r.visitId}/remind`, "POST").then((x) => { setMsg(x.ok ? "Pengingat terkirim." : x.message ?? "Gagal."); load(); })}>Ingatkan</button></div>
          </li>))}</ul>
      )}
      <p role="status" className="mt-2 text-sm text-muted">{msg}</p>
    </div>
  );
}
