"use client";

import { useCallback, useEffect, useState } from "react";
import { useDictate } from "./useDictate";
import { Badge, Card, Empty, Field, Input, Select, Skeleton, Tabs, api } from "./kit";

type Tool = "soap" | "tidy" | "summary" | "wa" | "report" | "faq" | "voice";
type Soap = { s?: string; o?: string; a?: string; p?: string };
const area = "w-full rounded-xl border border-line bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const NOTE = "Draf AI. Periksa dan koreksi sebelum dipakai; AI tidak membuat diagnosis atau resep.";

const DENTAL_PRESETS = [
  {
    label: "Pulpitis Ireversibel (PSA)",
    icon: "⚡",
    text: "Pasien mengeluh nyeri berdenyut spontan terutama malam hari sejak 3 hari, linu tajam saat minum dingin. Gigi 36 karies profunda perforasi disto-oklusal, sondasi (+), tes dingin (+) nyeri tajam menetap >10 detik, perkusi (-), palpasi (-), mobilitas normal. Diagnosis: Pulpitis ireversibel simtomatik gigi 36 (K04.01). Rencana: Informed consent, devitalisasi pulpa / pulpektomi, tumpat sementara, R/ Asam mefenamat 500mg 3x1 prn, kontrol 1 minggu untuk PSA.",
  },
  {
    label: "Karies Dentin (Restorasi)",
    icon: "🦷",
    text: "Pasien mengeluh makanan sering terselip di gigi belakang kanan atas dan ngilu saat makan/minum manis atau dingin. Gigi 16 karies media oklusal, sondasi (+), tes dingin (+) linu sebentar langsung hilang, perkusi (-), palpasi (-). Diagnosis: Karies dentin gigi 16 (K02.1) / Pulpitis reversibel. Rencana: Preparasi kavitas minimal invasif, etsa, bonding, restorasi komposit resin sinar, poles.",
  },
  {
    label: "Gingivitis / Karang Gigi (Scaling)",
    icon: "🪥",
    text: "Pasien mengeluhkan gusi mudah berdarah saat menyikat gigi dan napas kurang segar. Pemeriksaan intraoral: Kalkulus supragingiva dan subgingiva merata regio anterior dan posterior, gingiva marginal edema dan eritema, bleeding on probing (+). Diagnosis: Gingivitis marginalis ec kalkulus (K05.1). Rencana: Scaling ultrasonik RA/RB, pembersihan interdental, polishing, edukasi DHE.",
  },
  {
    label: "Nekrosis Pulpa / Gangren",
    icon: "⬛",
    text: "Pasien mengeluhkan gigi depan atas berubah warna keabuan dan terasa sedikit tebal saat mengunyah. Gigi 11 karies profunda/diskolorasi, sondasi (-), tes dingin (-), perkusi (+) ringan, palpasi (-). Diagnosis: Nekrosis pulpa gigi 11 (K04.1). Rencana: Foto periapikal, pembukaan akses dan disinfeksi saluran akar, medikasi Ca(OH)2, tumpat sementara.",
  },
  {
    label: "Persistensi / Cabut Gigi Sulung",
    icon: "👶",
    text: "Pasien anak diantar orang tua karena gigi bawah goyang dan gigi dewasa pengganti sudah mulai muncul di belakangnya. Gigi 71 goyang derajat 2, resorpsi akar fisiologis. Diagnosis: Persistensi gigi sulung 71 (K00.6). Rencana: Anestesi topikal, ekstraksi gigi 71, tampon antiseptik, instruksi pasca pencabutan.",
  },
  {
    label: "Periodontitis Kronis",
    icon: "🩺",
    text: "Pasien mengeluhkan gusi sering bengkak, gigi geraham bawah goyang ringan dan ngilu saat mengunyah. Gigi 46 poket periodontal 5mm, resesi gingiva 2mm, kalkulus subgingiva (+), BOP (+), perkusi (+). Diagnosis: Periodontitis kronis lokalisata gigi 46 (K05.3). Rencana: Root planing / kuretase tertutup gigi 46, irigasi antiseptik, edukasi oral hygiene.",
  },
] as const;

const SOAP_SECTION_CHIPS = [
  { label: "+ [S] Keluhan", text: "[S] Keluhan utama: " },
  { label: "+ [O] Fisik Gigi", text: "[O] Gigi ...: karies ..., sondasi (+), tes dingin (+), perkusi (-) " },
  { label: "+ [A] Diagnosis", text: "[A] Diagnosis: " },
  { label: "+ [P] Rencana/Rx", text: "[P] Rencana: 1. Informed consent. 2. Tindakan ... 3. Resep ... " },
] as const;

const QUICK_FINDINGS = [
  "Karies profunda",
  "Sondasi (+)",
  "Tes dingin (+)",
  "Perkusi (-)",
  "Mobility normal",
  "Devitalisasi pulpa",
  "Restorasi komposit",
  "Scaling RA & RB",
  "R/ Asam mefenamat 500mg",
] as const;

const SOAP_LABELS: Record<"s" | "o" | "a" | "p", { title: string; hint: string }> = {
  s: { title: "Subjective (S)", hint: "Keluhan utama, riwayat nyeri & alergi pasien" },
  o: { title: "Objective (O)", hint: "Pemeriksaan intraoral, tes vitalitas & perkusi gigi" },
  a: { title: "Assessment (A)", hint: "Diagnosis klinis definitif & kode ICD-10" },
  p: { title: "Plan (P)", hint: "Rencana perawatan hari ini, medikamentosa & kontrol" },
};

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

  const insertText = (chunk: string) => {
    setText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chunk;
      if (chunk.startsWith("[") || chunk.startsWith("\n")) return `${trimmed}\n${chunk}`;
      return `${trimmed}, ${chunk}`;
    });
  };

  const handleRunSoap = async (autoDraft: boolean = false) => {
    const targetText = text.trim() || (soap?.a ? `Diagnosis: ${soap.a}` : "");
    if (!targetText) return;
    const r = await call("soap", {
      text: targetText,
      patientId: visits.find((v) => v.id === vid)?.patientId,
      autoDraft,
    });
    if (r?.soap) {
      setSoap(r.soap);
      setTidy("");
      setMsg("");
    }
  };

  const handleCompleteEmpty = async () => {
    const summary = [
      soap?.a ? `Diagnosis: ${soap.a}` : "",
      soap?.s ? `Keluhan: ${soap.s}` : "",
      soap?.o ? `Fisik: ${soap.o}` : "",
      soap?.p ? `Rencana: ${soap.p}` : "",
      text.trim(),
    ].filter(Boolean).join("\n");
    if (!summary) return;
    const r = await call("soap", {
      text: summary,
      patientId: visits.find((v) => v.id === vid)?.patientId,
      autoDraft: true,
    });
    if (r?.soap) {
      setSoap(r.soap);
      setTidy("");
      setMsg("Draf SOAP berhasil dilengkapi secara klinis!");
    }
  };

  const apply = async () => {
    if (!soap || !vid) return;
    const cur = await api<{ visit: { soap?: Soap } }>(`/api/visits/${vid}`);
    const old = cur.ok ? cur.visit.soap ?? {} : {};
    const merged = Object.fromEntries((["s", "o", "a", "p"] as const).map((k) => [k, [old[k], soap[k]].filter(Boolean).join("\n")]));
    const r = await api(`/api/visits/${vid}`, "PATCH", { soap: merged });
    setMsg(r.ok ? "SOAP berhasil ditambahkan ke rekam medis kunjungan!" : r.message ?? "Gagal menyimpan.");
  };

  const hasEmptyFields = soap ? !soap.s?.trim() || !soap.o?.trim() || !soap.a?.trim() || !soap.p?.trim() : false;

  return (
    <Card title="Dikte & Asisten Rekam Medis (SOAP)">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select aria-label="Kunjungan tujuan" value={vid} onChange={(e) => setVid(e.target.value)} className="max-w-xs">
          <option value="">{visits.length ? "Pilih kunjungan berjalan…" : "Tidak ada kunjungan berjalan"}</option>
          {visits.map((v) => <option key={v.id} value={v.id}>{v.time} · {v.patientName}</option>)}
        </Select>
        <span className="text-xs text-muted">Opsional: pilih kunjungan untuk auto-samarkan nama dan simpan langsung ke rekam medis.</span>
      </div>

      {/* Quick Chips Section */}
      <div className="mb-4 space-y-2.5 rounded-xl border border-line bg-surface/50 p-3.5 text-xs">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-fg">✨ Template Kasus Gigi Populer:</span>
            <span className="text-[11px] text-muted">Klik untuk memuat catatan klinis lengkap</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DENTAL_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setText(p.text)}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-fg hover:border-accent hover:text-accent active:scale-95 transition-all"
                title={p.text}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line/60 pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-fg">🏷️ Komponen SOAP & Temuan Klinis:</span>
            <span className="text-[11px] text-muted">Klik untuk menyisipkan ke catatan</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SOAP_SECTION_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => insertText(c.text)}
                className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-medium text-accent hover:bg-accent/20 active:scale-95 transition-all"
              >
                {c.label}
              </button>
            ))}
            <span className="mx-1 self-center text-muted">|</span>
            {QUICK_FINDINGS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => insertText(f)}
                className="rounded-md border border-line bg-surface px-2 py-0.5 text-muted hover:border-fg hover:text-fg active:scale-95 transition-all"
              >
                + {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="ai-note">Catatan Klinis (Ketik, Dikte, atau Gunakan Template di Atas)</label>
        {text && (
          <button type="button" onClick={() => setText("")} className="text-xs text-muted hover:text-red-400">
            Bersihkan teks
          </button>
        )}
      </div>
      <textarea
        id="ai-note"
        className={area}
        rows={6}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Contoh: Pasien mengeluh nyeri berdenyut gigi 36 sejak 3 hari lalu terutama malam hari, linu tajam saat minum dingin. Pemeriksaan gigi 36 karies profunda disto oklusal perforasi, tes dingin (+), perkusi (-). Diagnosis pulpitis ireversibel simtomatik. Rencana devitalisasi pulpa, tumpat sementara, R/ Asam mefenamat 500mg..."
      />

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={dict.toggle}
          disabled={stt}
          className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-all ${rec ? "border-red-400 bg-red-500/10 text-red-300 animate-pulse" : "border-line hover:border-fg"}`}
          aria-pressed={rec}
        >
          {rec ? "■ Berhenti merekam" : stt ? "Mengubah suara…" : "● Dikte Suara"}
        </button>

        <button
          disabled={busy || text.trim().length < 2}
          className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all"
          onClick={() => handleRunSoap(false)}
        >
          {busy ? "Memproses…" : "Susun jadi SOAP"}
        </button>

        <button
          disabled={busy || text.trim().length < 2}
          className="min-h-11 rounded-xl border border-accent/50 bg-accent/15 px-4 text-sm font-medium text-accent hover:bg-accent/25 active:scale-95 disabled:opacity-40 transition-all"
          onClick={() => handleRunSoap(true)}
          title="Menyusun draf SOAP lengkap berstandar klinis meski catatan hanya berisi diagnosis atau gejala ringkas"
        >
          ✨ Draf Otomatis SOAP
        </button>

        {canTidy && (
          <button
            disabled={busy || text.trim().length < 2}
            className="min-h-11 rounded-xl border border-line px-4 text-sm hover:border-fg disabled:opacity-40"
            onClick={async () => {
              const r = await call("tidy", { text, patientId: visits.find((v) => v.id === vid)?.patientId });
              if (r?.text) {
                setTidy(r.text);
                setSoap(null);
              }
            }}
          >
            Rapikan saja
          </button>
        )}

        <span className="text-xs text-muted">Rekaman tidak disimpan. Nama dan kontak pasien disamarkan sebelum dikirim ke AI.</span>
      </div>

      {(err || dict.err) && <p role="alert" className="mt-3 text-sm text-red-300">{err || dict.err}</p>}
      {tidy && <Out text={tidy} />}

      {/* Output SOAP Sections */}
      {soap && (
        <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h3 className="font-semibold text-fg">Hasil Draf SOAP Klinis</h3>
              <p className="text-xs text-muted">Periksa dan sesuaikan sebelum disimpan ke rekam medis.</p>
            </div>
            {hasEmptyFields && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCompleteEmpty}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25 active:scale-95 disabled:opacity-40 transition-all"
              >
                <span>✨</span>
                <span>Lengkapi Draf Kosong dengan AI</span>
              </button>
            )}
          </div>

          {(["s", "o", "a", "p"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-fg" htmlFor={`ai-${k}`}>
                  {SOAP_LABELS[k].title}
                </label>
                <span className="text-[11px] text-muted">{SOAP_LABELS[k].hint}</span>
              </div>
              <textarea
                id={`ai-${k}`}
                className={area}
                rows={3}
                value={soap[k] ?? ""}
                placeholder={`Belum terisi. Klik "✨ Lengkapi Draf Kosong dengan AI" atau ketik manual...`}
                onChange={(e) => setSoap({ ...soap, [k]: e.target.value })}
              />
            </div>
          ))}

          <p className="text-xs text-muted">{NOTE}</p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              disabled={!vid}
              className="min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-bg hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all"
              onClick={apply}
            >
              Tambahkan ke SOAP kunjungan
            </button>
            <button
              className="min-h-11 rounded-xl border border-line px-4 text-sm hover:border-fg active:scale-95"
              onClick={() => {
                const outText = (["s", "o", "a", "p"] as const)
                  .map((k) => `${k.toUpperCase()} (${SOAP_LABELS[k].title}):\n${soap[k] ?? "-"}`)
                  .join("\n\n");
                void navigator.clipboard?.writeText(outText);
                setMsg("Format SOAP berhasil disalin ke clipboard ✓");
                setTimeout(() => setMsg(""), 2000);
              }}
            >
              Salin SOAP
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleRunSoap(true)}
              className="min-h-11 rounded-xl border border-line px-4 text-sm text-muted hover:border-fg hover:text-fg"
            >
              Regenerasi Draf
            </button>
            <button
              type="button"
              onClick={() => setSoap(null)}
              className="min-h-11 rounded-xl border border-transparent px-3 text-sm text-muted hover:text-red-400"
            >
              Tutup
            </button>
          </div>
          {msg && <p role="status" className="text-sm font-medium text-accent">{msg}</p>}
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
