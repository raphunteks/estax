"use client";

import { useCallback, useEffect, useState } from "react";
import { useDictate } from "./useDictate";
import { Badge, Card, Empty, Field, Input, Select, Skeleton, Tabs, api } from "./kit";

type Tool = "soap" | "tidy" | "summary" | "wa" | "report" | "faq" | "voice";
type Soap = { s?: string; o?: string; a?: string; p?: string };
const area = "w-full rounded-xl border border-line bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const NOTE = "Draf AI. Periksa dan koreksi sebelum dipakai; AI tidak membuat diagnosis atau resep.";

function Out({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-line p-4">
      <p className="whitespace-pre-wrap text-sm">{text}</p>
      <div className="mt-3 flex items-center gap-3">
        <button className="rounded-full border border-line px-4 py-1.5 text-xs" onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); onCopy?.(); setTimeout(() => setOk(false), 1500); }}>{ok ? "Tersalin ✓" : "Salin"}</button>
        <span className="text-xs text-muted">{NOTE}</span>
      </div>
    </div>
  );
}

function useCall<T = { text?: string }>() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const call = async (tool: string, body: object): Promise<(T & { ok: true }) | null> => {
    setBusy(true); setErr("");
    const r = await api<T>(`/api/ai/${tool}`, "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? "AI gagal."); return null; }
    return r as unknown as T & { ok: true };
  };
  return { busy, err, call, setErr };
}

function Dictation({ canTidy }: { canTidy: boolean }) {
  const [text, setText] = useState("");
  const [soap, setSoap] = useState<Soap | null>(null);
  const [tidy, setTidy] = useState("");
  const [visits, setVisits] = useState<{ id: string; patientId: string; patientName: string; time: string }[]>([]);
  const [vid, setVid] = useState("");
  const [msg, setMsg] = useState("");
  const { busy, err, call } = useCall<{ soap?: Soap; text?: string }>();
  useEffect(() => {
    const t = setTimeout(() => void api<{ visits: typeof visits }>("/api/visits?mine=1").then((r) => r.ok && setVisits(r.visits)), 0);
    return () => clearTimeout(t);
  }, []);
  const dict = useDictate((t) => setText((x) => (x ? `${x}\n` : "") + t));
  const { rec, busy: stt } = dict;
  const apply = async () => {
    if (!soap || !vid) return;
    const cur = await api<{ visit: { soap?: Soap } }>(`/api/visits/${vid}`);
    const old = cur.ok ? cur.visit.soap ?? {} : {};
    const merged = Object.fromEntries((["s", "o", "a", "p"] as const).map((k) => [k, [old[k], soap[k]].filter(Boolean).join("\n")]));
    const r = await api(`/api/visits/${vid}`, "PATCH", { soap: merged });
    setMsg(r.ok ? "SOAP ditambahkan ke kunjungan. Tinjau di halaman Pemeriksaan." : r.message ?? "Gagal menyimpan.");
  };
  return (
    <Card title="Dikte dan rapikan catatan">
      <div className="mb-4 flex flex-wrap items-center gap-2"><Select aria-label="Kunjungan tujuan" value={vid} onChange={(e) => setVid(e.target.value)} className="max-w-xs"><option value="">{visits.length ? "Pilih kunjungan berjalan…" : "Tidak ada kunjungan berjalan"}</option>{visits.map((v) => <option key={v.id} value={v.id}>{v.time} · {v.patientName}</option>)}</Select><span className="text-xs text-muted">Pilih kunjungan agar nama pasien ikut disamarkan dan SOAP bisa ditambahkan.</span></div>
      <label className="mb-1 block text-sm" htmlFor="ai-note">Catatan (ketik atau dikte)</label>
      <textarea id="ai-note" className={area} rows={6} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Contoh: pasien datang dengan nyeri gigi 36 sejak tiga hari, perkusi positif, karies dalam, rencana PSA…" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={dict.toggle} disabled={stt} className={`min-h-11 rounded-xl border px-4 text-sm ${rec ? "border-red-400 text-red-300" : "border-line"}`} aria-pressed={rec}>{rec ? "■ Berhenti merekam" : stt ? "Mengubah suara…" : "● Dikte"}</button>
        <button disabled={busy || text.trim().length < 2} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg disabled:opacity-40" onClick={async () => { const r = await call("soap", { text, patientId: visits.find((v) => v.id === vid)?.patientId }); if (r?.soap) { setSoap(r.soap); setTidy(""); } }}>{busy ? "Memproses…" : "Susun jadi SOAP"}</button>
        {canTidy && <button disabled={busy || text.trim().length < 2} className="min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-40" onClick={async () => { const r = await call("tidy", { text, patientId: visits.find((v) => v.id === vid)?.patientId }); if (r?.text) { setTidy(r.text); setSoap(null); } }}>Rapikan saja</button>}
        <span className="text-xs text-muted">Rekaman tidak disimpan. Nama dan kontak pasien dibuang sebelum dikirim ke AI.</span>
      </div>
      {(err || dict.err) && <p role="alert" className="mt-3 text-sm text-red-300">{err || dict.err}</p>}
      {tidy && <Out text={tidy} />}
      {soap && (
        <div className="mt-4 space-y-3">
          {(["s", "o", "a", "p"] as const).map((k) => (
            <div key={k}><label className="mb-1 block text-xs text-muted" htmlFor={`ai-${k}`}>{{ s: "Subjective", o: "Objective", a: "Assessment", p: "Plan" }[k]}</label><textarea id={`ai-${k}`} className={area} rows={3} value={soap[k] ?? ""} onChange={(e) => setSoap({ ...soap, [k]: e.target.value })} /></div>
          ))}
          <p className="text-xs text-muted">{NOTE}</p>
          <div className="flex flex-wrap items-center gap-2">
            
            <button disabled={!vid} className="min-h-11 rounded-xl bg-accent/20 px-4 text-sm text-accent disabled:opacity-40" onClick={apply}>Tambahkan ke SOAP kunjungan</button>
            <button className="min-h-11 rounded-xl border border-line px-4 text-sm" onClick={() => void navigator.clipboard?.writeText((["s", "o", "a", "p"] as const).map((k) => `${k.toUpperCase()}: ${soap[k] ?? ""}`).join("\n"))}>Salin</button>
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>
      )}
    </Card>
  );
}

function Summary({ isSuper }: { isSuper: boolean }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<{ id: string; name: string; rmNo: string | null }[]>([]);
  const [pid, setPid] = useState("");
  const [reason, setReason] = useState("");
  const [out, setOut] = useState("");
  const { busy, err, call } = useCall();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => void api<{ patients: typeof list }>(`/api/patients?q=${encodeURIComponent(q)}`).then((r) => r.ok && setList(r.patients.slice(0, 8))), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Card title="Ringkasan pasien">
      <p className="mb-3 text-sm text-muted">Ringkasan dibuat dari riwayat kunjungan selesai tanpa nama, kontak, atau tanggal lahir.</p>
      <Field label="Cari pasien (nama, No RM, HP)"><Input value={q} onChange={(e) => (setQ(e.target.value), setPid(""))} /></Field>
      {q.trim().length >= 2 && !pid && <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">{list.map((p) => <li key={p.id}><button className="w-full px-3 py-2 text-left hover:bg-accent/10" onClick={() => (setPid(p.id), setQ(`${p.name}${p.rmNo ? ` · ${p.rmNo}` : ""}`))}>{p.name} <span className="text-muted">{p.rmNo ?? ""}</span></button></li>)}{!list.length && <li className="px-3 py-2 text-muted">Tidak ditemukan.</li>}</ul>}
      {isSuper && <div className="mt-3"><Field label="Alasan akses (dicatat di audit)"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field></div>}
      <button disabled={!pid || busy || (isSuper && reason.trim().length < 5)} className="mt-4 min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg disabled:opacity-40" onClick={async () => { const r = await call("summary", { patientId: pid, reason: reason || undefined }); if (r?.text) setOut(r.text); }}>{busy ? "Memproses…" : "Buat ringkasan"}</button>
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
      {out && <Out text={out} />}
    </Card>
  );
}

function Ask({ title, field, tool, hint, days }: { title: string; field: "message" | "question"; tool: "wa" | "report"; hint: string; days?: boolean }) {
  const [v, setV] = useState("");
  const [d, setD] = useState(30);
  const [out, setOut] = useState("");
  const { busy, err, call } = useCall();
  return (
    <Card title={title}>
      <label htmlFor={`ai-${tool}`} className="mb-1 block text-sm">{hint}</label>
      <textarea id={`ai-${tool}`} className={area} rows={4} maxLength={field === "message" ? 1000 : 400} value={v} onChange={(e) => setV(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {days && <Select aria-label="Periode" value={d} onChange={(e) => setD(Number(e.target.value))} className="max-w-[10rem]"><option value={7}>7 hari</option><option value={30}>30 hari</option><option value={90}>90 hari</option></Select>}
        <button disabled={busy || v.trim().length < 2} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg disabled:opacity-40" onClick={async () => { const r = await call(tool, { [field]: v, ...(days ? { days: d } : {}) }); if (r?.text) setOut(r.text); }}>{busy ? "Memproses…" : tool === "wa" ? "Buat balasan" : "Tanya"}</button>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
      {out && <Out text={out} />}
    </Card>
  );
}

function Diagnostic() {
  const [steps, setSteps] = useState<{ step: string; ok: boolean; ms: number; detail: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Cek koneksi 9Router">
      <p className="mb-3 text-sm text-muted">Menguji dari server aplikasi: apakah 9Router menjawab chat dan punya model dikte (STT). Tidak ada data pasien yang dikirim.</p>
      <button type="button" className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg disabled:opacity-40" disabled={busy} onClick={async () => { setBusy(true); const r = await api<{ steps: NonNullable<typeof steps> }>("/api/ai", "POST", {}); setBusy(false); setSteps(r.ok ? r.steps : [{ step: "server", ok: false, ms: 0, detail: r.message ?? "gagal" }]); }}>{busy ? "Menguji…" : "Jalankan tes"}</button>
      {steps && (
        <ul className="mt-4 space-y-1.5 text-sm" aria-live="polite">
          {steps.map((x) => <li key={x.step} className="flex flex-wrap items-center gap-2"><Badge tone={x.ok ? "ok" : "bad"}>{x.ok ? "OK" : "Gagal"}</Badge><strong>{x.step}</strong><span className="text-muted">{x.ms} ms · {x.detail}</span></li>)}
        </ul>
      )}
    </Card>
  );
}

export default function AiAssistant({ role }: { role: string }) {
  const [st, setSt] = useState<{ ready: boolean; reason: string | null; tools: Tool[] } | null>(null);
  const [tab, setTab] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ ready: boolean; reason: string | null; tools: Tool[] }>("/api/ai");
    if (r.ok) { setSt(r); setTab((t) => t || (r.tools.includes("soap") ? "note" : r.tools.includes("wa") ? "wa" : "report")); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  if (!st) return <Skeleton />;
  const has = (t: Tool) => st.tools.includes(t);
  const tabs: [string, string][] = [...(has("soap") ? [["note", "Dikte & catatan"]] : []), ...(has("summary") ? [["sum", "Ringkasan pasien"]] : []), ...(has("wa") ? [["wa", "Balasan WhatsApp"]] : []), ...(role === "superadmin" ? [["diag", "Cek koneksi"]] : []), ...(has("report") ? [["report", "Tanya laporan"]] : [])] as [string, string][];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3"><h1 className="display text-3xl">Asisten AI</h1><Badge tone={st.ready ? "ok" : "warn"}>{st.ready ? "Aktif" : "Belum aktif"}</Badge></div>
      {!st.ready && <p role="alert" className="mb-5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">{st.reason}</p>}
      {!tabs.length ? <Empty>Tidak ada alat AI untuk peran ini.</Empty> : <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === "note" && <Dictation canTidy />}
      {tab === "diag" && <Diagnostic />}
      {tab === "sum" && <Summary isSuper={role === "superadmin"} />}
      {tab === "wa" && <Ask title="Balasan WhatsApp" field="message" tool="wa" hint="Tempel pesan dari pasien (nomor dan nama otomatis disamarkan)" />}
      {tab === "report" && <Ask title="Tanya laporan" field="question" tool="report" days hint="Pertanyaan tentang angka klinik, mis. “Hari apa paling sepi bulan ini?”" />}
    </div>
  );
}
