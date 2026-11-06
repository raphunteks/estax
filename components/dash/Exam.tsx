"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import IcdPicker, { type Dx } from "@/components/dash/IcdPicker";
import ExamAi from "@/components/dash/ExamAi";
import { Badge, Card, Empty, Field, Input, Select, Skeleton, Tabs, api, fmtDate } from "@/components/dash/kit";
import Odontogram from "@/components/dash/Odontogram";
import { emptyOdo, type Odo } from "@/lib/clinic/odontogram";

type Plan = { id: string; text: string; tooth?: string; status: "rencana" | "selesai" };
type Proc = { id: string; name: string; tooth?: string; note?: string };
type Rx = { id: string; drug: string; dose: string; freq: string; days: string; note?: string };
type V = {
  id: string; status: "berjalan" | "selesai"; date: string; doctorId: string;
  patient: { id: string; name: string; rmNo: string | null; birthDate: string; gender: string; health: Record<string, unknown> } | null;
  anamnesis: Record<string, string | undefined>; vitals: Record<string, string | undefined>;
  soap?: Record<string, string | undefined>; diagnoses?: Dx[]; plan?: Plan[]; procedures?: Proc[]; rx?: Rx[]; odo?: Odo;
};
type Res = { level: "basic" | "full"; owner?: boolean; visit: V; previousOdo?: Odo | null; previousDate?: string | null };

const uid = () => Math.random().toString(36).slice(2, 10);
const area = "min-h-24 w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent";

/** Debounced autosave of one section; reports state so the doctor always knows whether it is stored. */
function useSave(id: string) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const save = useCallback((key: string, body: object, delay = 700) => {
    clearTimeout(timers.current[key]);
    setState("saving");
    timers.current[key] = setTimeout(async () => {
      const r = await api(`/api/visits/${id}`, "PATCH", body);
      setState(r.ok ? "saved" : "error");
    }, delay);
  }, [id]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  return { state, save };
}

/** Doctor/staff note to the patient's phone, or doctor to the pharmacy. Plain text, max 200 characters. */
function NotifyBar({ visitId, role }: { visitId: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"patient" | "farmasi">("patient");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true); setMsg("");
    const r = await api<{ sent: number }>("/api/push/send", "POST", { target, visitId, message: text });
    setBusy(false);
    if (!r.ok) return setMsg(r.message ?? "Gagal mengirim.");
    setText("");
    setMsg(r.sent ? `Terkirim ke ${r.sent} perangkat.` : target === "patient" ? "Tersimpan di kotak masuk pasien (belum ada perangkat dengan notifikasi aktif)." : "Tersimpan di kotak masuk apoteker (belum ada perangkat aktif).");
  }
  return (
    <div className="mb-4">
      <button className="btn btn-ghost min-h-10" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Tutup pesan" : "Kirim pesan / notifikasi"}</button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[10rem_1fr_auto]">
          <Select aria-label="Tujuan" value={target} onChange={(e) => setTarget(e.target.value as "patient" | "farmasi")}>
            <option value="patient">Ke pasien</option>
            {role !== "staf" && <option value="farmasi">Ke farmasi</option>}
          </Select>
          <Input aria-label="Pesan" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={target === "patient" ? "Mis. Mohon menuju ruang radiologi" : "Mis. Resep diutamakan, pasien anak"} />
          <button className="btn btn-primary" disabled={busy || text.trim().length < 2} onClick={() => void send()}>{busy ? "Mengirim…" : "Kirim"}</button>
          <p role="status" className="min-h-5 text-xs text-muted sm:col-span-3">{msg}</p>
        </div>
      )}
    </div>
  );
}

export function ExamWorkspace({ id, role }: { id: string; role: "superadmin" | "dokter" | "staf" }) {
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState("anamnesis");
  const { state, save } = useSave(id);

  const load = useCallback(async (why?: string) => {
    const r = await api<Res>(`/api/visits/${id}${why ? `?reason=${encodeURIComponent(why)}` : ""}`);
    if (r.ok) setRes(r as unknown as Res);
    else setErr(r.code === "reason_required" ? "reason" : r.message ?? "Gagal memuat kunjungan.");
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => void (role === "superadmin" ? setErr("reason") : load()), 0);
    return () => clearTimeout(t);
  }, [load, role]);

  if (err === "reason")
    return (
      <Card title="Akses rekam medis">
        <p className="mb-3 text-sm text-muted">Akses superadmin ke rekam medis klinis harus beralasan dan dicatat di audit.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), reason.trim().length >= 5 && load(reason.trim()).then(() => setErr("")))}>
          <Field label="Alasan akses"><Input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required /></Field>
          <button className="btn btn-primary min-h-11" type="submit">Buka</button>
        </form>
      </Card>
    );
  if (err) return <Empty>{err}</Empty>;
  if (!res) return <Skeleton />;

  const v = res.visit;
  const full = res.level === "full";
  const canEditBasic = v.status === "berjalan" && (res.owner || role === "staf");
  const canEdit = v.status === "berjalan" && !!res.owner;
  const upd = (patch: Partial<V>) => setRes({ ...res, visit: { ...v, ...patch } });
  const tabs: [string, string][] = full ? [["anamnesis", "Anamnesis & vital"], ["odo", "Odontogram"], ["soap", "SOAP"], ["plan", "Rencana & tindakan"], ["rx", "Resep"]] : [["anamnesis", "Anamnesis & vital"]];

  const text = (sec: "anamnesis" | "vitals" | "soap", k: string, label: string, ro: boolean, multiline = true) => {
    const val = ((v[sec] ?? {}) as Record<string, string | undefined>)[k] ?? "";
    const on = (x: string) => {
      const next = { ...(v[sec] ?? {}), [k]: x };
      upd({ [sec]: next } as Partial<V>);
      save(sec, { [sec]: { [k]: x } });
    };
    return (
      <Field label={label}>
        {multiline ? <textarea name="exam-textarea-85" className={area} value={val} readOnly={ro} onChange={(e) => on(e.target.value)} /> : <Input value={val} readOnly={ro} onChange={(e) => on(e.target.value)} />}
      </Field>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">{v.patient?.name ?? "Pasien"}</h1>
          <p className="mt-1 text-sm text-muted">RM {v.patient?.rmNo ?? "belum ada"} · {fmtDate(v.date)} · <Badge tone={v.status === "selesai" ? "ok" : "warn"}>{v.status === "selesai" ? "Selesai" : "Berjalan"}</Badge></p>
        </div>
        <p className="text-xs text-muted" role="status" aria-live="polite">{state === "saving" ? "Menyimpan…" : state === "saved" ? "Tersimpan" : state === "error" ? "Gagal menyimpan, periksa koneksi" : ""}</p>
      </div>
      {v.patient && typeof v.patient.health?.allergies === "string" && v.patient.health.allergies && <p className="mb-4 rounded-xl border border-line bg-card px-4 py-2 text-sm"><strong>Alergi tercatat:</strong> {v.patient.health.allergies}</p>}
      <NotifyBar visitId={id} role={role} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "anamnesis" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Anamnesis">
            <div className="space-y-3">
              {text("anamnesis", "complaint", "Keluhan utama", !canEditBasic)}
              {text("anamnesis", "history", "Riwayat penyakit sekarang", !canEditBasic)}
              {text("anamnesis", "allergies", "Alergi", !canEditBasic, false)}
              {text("anamnesis", "medications", "Obat yang sedang dikonsumsi", !canEditBasic, false)}
              {text("anamnesis", "conditions", "Penyakit sistemik", !canEditBasic, false)}
            </div>
          </Card>
          <Card title="Tanda vital">
            <div className="grid grid-cols-2 gap-3">
              {text("vitals", "bp", "Tekanan darah", !canEditBasic, false)}
              {text("vitals", "pulse", "Nadi", !canEditBasic, false)}
              {text("vitals", "temp", "Suhu (°C)", !canEditBasic, false)}
              {text("vitals", "weight", "Berat (kg)", !canEditBasic, false)}
              {text("vitals", "spo2", "SpO₂ (%)", !canEditBasic, false)}
            </div>
          </Card>
        </div>
      )}

      {full && tab === "odo" && (
        <Card title="Odontogram">
          <Odontogram value={v.odo ?? emptyOdo()} previous={res.previousOdo} readOnly={!canEdit} onChange={(o) => (upd({ odo: o }), save("odo", { odo: o }, 400))} />
          {res.previousDate && <p className="mt-3 text-xs text-muted">Pembanding: kunjungan {fmtDate(res.previousDate)}.</p>}
        </Card>
      )}

      {full && tab === "soap" && (
        <div className="mb-4">
          <Card title="Diagnosis (ICD-10)">
            <IcdPicker value={v.diagnoses ?? []} readOnly={!canEdit} onChange={(diagnoses) => (upd({ diagnoses }), save("diagnoses", { diagnoses }, 300))} />
          </Card>
        </div>
      )}
      {full && tab === "soap" && (
        <Card title="Catatan SOAP">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("soap", "s", "Subjective", !canEdit)}
            {text("soap", "o", "Objective", !canEdit)}
            {text("soap", "a", "Assessment", !canEdit)}
            {text("soap", "p", "Plan", !canEdit)}
          </div>
        </Card>
      )}
      {full && tab === "soap" && (
        <ExamAi
          visitId={id} patientId={v.patient?.id ?? ""} canEdit={canEdit} reason={role === "superadmin" ? reason : undefined}
          checks={[
            { ok: Boolean(v.anamnesis?.complaint?.trim()), label: "Keluhan utama terisi" },
            { ok: Boolean(v.anamnesis?.allergies?.trim()), label: "Alergi dikonfirmasi (tulis “tidak ada” bila tidak ada)" },
            { ok: Boolean(v.vitals?.bp || v.vitals?.pulse), label: "Tanda vital dasar (tekanan darah atau nadi)" },
            { ok: (v.diagnoses ?? []).length > 0, label: "Diagnosis ICD-10 dipilih" },
            { ok: (["s", "o", "a", "p"] as const).every((k) => Boolean(v.soap?.[k]?.trim())), label: "SOAP lengkap (S, O, A, P)" },
            { ok: (v.procedures ?? []).some((x) => x.name.trim()), label: "Tindakan hari ini tercatat" },
            { ok: (v.plan ?? []).length > 0, label: "Rencana perawatan lanjutan" },
          ]}
          onApply={(sp) => {
            const merged = Object.fromEntries((["s", "o", "a", "p"] as const).map((k) => [k, [v.soap?.[k], sp[k]].filter(Boolean).join("\n")]));
            upd({ soap: merged });
            save("soap", { soap: merged });
          }}
        />
      )}

      {full && tab === "plan" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListEditor<Plan>
            title="Rencana perawatan" items={v.plan ?? []} ro={!canEdit} empty="Belum ada rencana."
            make={() => ({ id: uid(), text: "", status: "rencana" })}
            onChange={(plan) => (upd({ plan }), save("plan", { plan }))}
            row={(it, set) => (
              <>
                <Input aria-label="Rencana" placeholder="Rencana" value={it.text} readOnly={!canEdit} onChange={(e) => set({ text: e.target.value })} />
                <Input aria-label="Gigi" placeholder="Gigi" className="!w-20" value={it.tooth ?? ""} readOnly={!canEdit} onChange={(e) => set({ tooth: e.target.value })} />
                <button type="button" disabled={!canEdit} onClick={() => set({ status: it.status === "rencana" ? "selesai" : "rencana" })} className="min-h-10 rounded-lg border border-line px-2 text-xs">{it.status === "selesai" ? "Selesai" : "Rencana"}</button>
              </>
            )}
          />
          <ListEditor<Proc>
            title="Tindakan hari ini" items={v.procedures ?? []} ro={!canEdit} empty="Belum ada tindakan."
            make={() => ({ id: uid(), name: "" })}
            onChange={(procedures) => (upd({ procedures }), save("procedures", { procedures }))}
            row={(it, set) => (
              <>
                <Input aria-label="Tindakan" placeholder="Tindakan" value={it.name} readOnly={!canEdit} onChange={(e) => set({ name: e.target.value })} />
                <Input aria-label="Gigi" placeholder="Gigi" className="!w-20" value={it.tooth ?? ""} readOnly={!canEdit} onChange={(e) => set({ tooth: e.target.value })} />
              </>
            )}
          />
        </div>
      )}

      {full && tab === "rx" && (
        <ListEditor<Rx>
          title="Resep" items={v.rx ?? []} ro={!canEdit} empty="Belum ada resep."
          make={() => ({ id: uid(), drug: "", dose: "", freq: "", days: "" })}
          onChange={(rx) => (upd({ rx }), save("rx", { rx }))}
          row={(it, set) => (
            <>
              <Input aria-label="Obat" placeholder="Obat" value={it.drug} readOnly={!canEdit} onChange={(e) => set({ drug: e.target.value })} />
              <Input aria-label="Dosis" placeholder="Dosis" className="!w-24" value={it.dose} readOnly={!canEdit} onChange={(e) => set({ dose: e.target.value })} />
              <Input aria-label="Aturan pakai" placeholder="3 x sehari" className="!w-28" value={it.freq} readOnly={!canEdit} onChange={(e) => set({ freq: e.target.value })} />
              <Input aria-label="Hari" placeholder="Hari" className="!w-16" value={it.days} readOnly={!canEdit} onChange={(e) => set({ days: e.target.value })} />
            </>
          )}
        />
      )}

      {canEdit && (
        <div className="mt-8 flex justify-end">
          <button className="btn btn-primary min-h-12" onClick={async () => { if (!confirm("Selesaikan kunjungan? Setelah selesai catatan terkunci.")) return; const r = await api(`/api/visits/${id}`, "PATCH", { finish: true }); if (r.ok) upd({ status: "selesai" }); else setErr(r.message ?? "Gagal menyelesaikan."); }}>
            Selesaikan kunjungan
          </button>
        </div>
      )}
    </div>
  );
}

function ListEditor<T extends { id: string }>({ title, items, ro, empty, make, onChange, row }: { title: string; items: T[]; ro: boolean; empty: string; make: () => T; onChange: (x: T[]) => void; row: (it: T, set: (p: Partial<T>) => void) => React.ReactNode }) {
  return (
    <Card title={title} right={!ro ? <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-sm hover:bg-card" onClick={() => onChange([...items, make()])}>Tambah</button> : undefined}>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-2">
              {row(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}
              {!ro && <button type="button" aria-label="Hapus baris" className="min-h-10 rounded-lg px-2 text-muted hover:text-fg" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type Row = { id: string; patientId: string; patientName: string; rmNo: string | null; time: string; status: string; queueNo?: number; complaint?: string };
/** Doctor's list of patients ready to examine today. */
export function ExamQueue() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    const r = await api<{ appointments: Row[] }>(`/api/appointments?date=${d}`);
    setRows(r.ok ? (r.appointments ?? []).filter((a) => ["checkin", "dipanggil", "dikursi", "selesai"].includes(a.status)) : []);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const i = setInterval(load, 15000);
    return () => (clearTimeout(t), clearInterval(i));
  }, [load]);
  const call = async (id: string, action: "call" | "recall") => {
    const r = await api(`/api/appointments/${id}`, "PATCH", { action });
    if (r.ok) void load(); else setErr(r.message ?? "Gagal memanggil pasien.");
  };
  const start = async (apptId: string) => {
    const r = await api<{ id: string }>("/api/visits", "POST", { apptId });
    if (r.ok) window.location.assign(`/dashboard/periksa/${(r as { id: string }).id}`);
    else setErr(r.message ?? "Tidak bisa memulai pemeriksaan.");
  };
  if (!rows) return <Skeleton />;
  return (
    <div>
      <div className="mb-3 flex justify-end"><a href="/monitor-antrean-poliklinik" target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-10">Buka monitor TV ↗</a></div>
      {err && <p role="alert" className="mb-3 text-sm text-[var(--bad)]">{err}</p>}
      {rows.length === 0 ? <Empty>Belum ada pasien yang check-in hari ini.</Empty> : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
              <div>
                <p className="font-semibold">{a.queueNo ? `#${a.queueNo} · ` : ""}{a.patientName} <span className="text-sm font-normal text-muted">{a.time} · RM {a.rmNo ?? "-"}</span></p>
                {a.complaint && <p className="text-sm text-muted">{a.complaint}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={a.status === "selesai" ? "ok" : "warn"}>{a.status}</Badge>
                {a.status === "checkin" && <button className="btn btn-ghost min-h-10" onClick={() => void call(a.id, "call")}>Panggil</button>}
                {a.status === "dipanggil" && <button className="btn btn-ghost min-h-10" onClick={() => void call(a.id, "recall")}>Panggil ulang</button>}
                <button className="btn btn-primary min-h-10" onClick={() => start(a.id)}>{a.status === "selesai" ? "Buka" : "Mulai"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Visit history on a patient profile. */
export function VisitHistory({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<{ id: string; date: string; status: string; complaint: string }[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => void api<{ visits: { id: string; date: string; status: string; complaint: string }[] }>(`/api/visits?patientId=${patientId}`).then((r) => setRows(r.ok ? r.visits ?? [] : [])), 0);
    return () => clearTimeout(t);
  }, [patientId]);
  if (!rows) return <Skeleton />;
  return rows.length === 0 ? <Empty>Belum ada kunjungan klinis.</Empty> : (
    <ul className="divide-y divide-line">
      {rows.map((v) => (
        <li key={v.id}><Link href={`/dashboard/periksa/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-accent"><span>{fmtDate(v.date)} <span className="text-sm text-muted">{v.complaint}</span></span><Badge tone={v.status === "selesai" ? "ok" : "warn"}>{v.status}</Badge></Link></li>
      ))}
    </ul>
  );
}
