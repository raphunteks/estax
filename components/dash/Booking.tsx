"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, Input, Select, api } from "./kit";
import { addD, witaToday } from "./kit";

export type Opts = { poliklinik: { id: string; name: string }[]; paytypes: { id: string; name: string; needsNumber: boolean }[]; rules: { horizonDays: number; cancelHoursBefore: number }; doctors: { id: string; name: string; poliklinikId: string | null; openDays: number[]; leave: string[] }[] };
type Slot = { start: string; end: string; state: "free" | "booked" | "held" | "past" };

/** Date + free-slot chips for one doctor. Calls onPick with the chosen time (and holds it for 5 minutes when `hold` is set). */
export function SlotPicker({ doctorId, date, value, onPick, hold, refresh = 0 }: { doctorId: string; date: string; value?: string; onPick: (t: string) => void; hold?: boolean; refresh?: number }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let live = true;
    if (!doctorId || !date) return;
    void api<{ slots: Slot[] }>(`/api/slots?doctor=${doctorId}&date=${date}`).then((d) => live && setSlots(d.ok ? d.slots : []));
    return () => void (live = false);
  }, [doctorId, date, refresh]);
  async function pick(t: string) {
    setMsg("");
    if (hold) {
      const d = await api("/api/slots/hold", "POST", { doctorId, date, time: t });
      if (!d.ok) return setMsg(d.message ?? "Slot tidak tersedia.");
    }
    onPick(t);
  }
  if (!doctorId || !date) return null;
  if (!slots) return <div className="h-12 animate-pulse rounded-xl bg-fg/5" aria-label="Memuat jam" />;
  const free = slots.filter((s) => s.state !== "past");
  const full = free.length > 0 && free.every((s) => s.state !== "free");
  if (!free.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Tidak ada jam praktik pada tanggal ini.</p>;
  return (
    <div>
      <div role="radiogroup" aria-label="Jam tersedia" className="flex flex-wrap gap-2">
        {free.map((s) => (
          <button key={s.start} type="button" role="radio" aria-checked={value === s.start} disabled={s.state !== "free"} onClick={() => void pick(s.start)} className={`min-h-10 rounded-xl border px-3 text-sm tabular-nums transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 ${value === s.start ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-fg"}`}>
            {s.start}
          </button>
        ))}
      </div>
      {full && hold && <Waitlist doctorId={doctorId} date={date} />}
      {msg && <p role="alert" className="mt-2 text-xs text-red-400">{msg}</p>}
    </div>
  );
}

function Waitlist({ doctorId, date }: { doctorId: string; date: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => void api<{ on: boolean }>(`/api/portal/waitlist?doctorId=${doctorId}&date=${date}`).then((r) => setOn(r.ok ? r.on : false)), [doctorId, date]);
  const toggle = async () => { const r = await api("/api/portal/waitlist" + (on ? `?doctorId=${doctorId}&date=${date}` : ""), on ? "DELETE" : "POST", on ? undefined : { doctorId, date }); if (r.ok) setOn(!on); };
  return (
    <div className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm">
      <p className="text-muted">Semua jam penuh. {on ? "Anda masuk daftar tunggu. Kami beri tahu bila ada slot kosong." : "Mau diberi tahu bila ada slot kosong?"}</p>
      <button type="button" disabled={on === null} onClick={() => void toggle()} className="btn btn-ghost mt-2 min-h-10">{on ? "Keluar dari daftar tunggu" : "Masuk daftar tunggu"}</button>
    </div>
  );
}

type Pat = { id: string; name: string; rmNo: string | null };
export function BookingForm({ mode, presetPatient, preset, onDone }: { mode: "staf" | "pasien"; presetPatient?: Pat; preset?: { doctorId?: string; date?: string; time?: string }; onDone: () => void }) {
  const [o, setO] = useState<Opts | null>(null);
  const [poli, setPoli] = useState("");
  const [doctor, setDoctor] = useState(preset?.doctorId ?? "");
  const [date, setDate] = useState(preset?.date ?? "");
  const [time, setTime] = useState(preset?.time ?? "");
  const [pay, setPay] = useState("");
  const [payNo, setPayNo] = useState("");
  const [complaint, setComplaint] = useState("");
  const [patient, setPatient] = useState<Pat | undefined>(presetPatient);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Pat[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [members, setMembers] = useState<{ id: string; name: string; relation: string }[]>([]);
  const [who, setWho] = useState("");
  const [promos, setPromos] = useState<{ id: string; name: string; kind: string; value: number }[]>([]);
  const [promoId, setPromoId] = useState("");
  useEffect(() => {
    if (mode !== "pasien") return;
    void api<{ members: { id: string; name: string; relation: string }[] }>("/api/portal/keluarga").then((r) => r.ok && setMembers(r.members));
    void api<{ promos: { id: string; name: string; kind: string; value: number }[] }>("/api/portal/promo").then((r) => r.ok && setPromos(r.promos));
  }, [mode]);

  useEffect(() => void api<Opts>("/api/booking/options").then((d) => d.ok && (setO(d as unknown as Opts), setPay((d as unknown as Opts).paytypes[0]?.id ?? ""))), []);
  useEffect(() => {
    if (mode !== "staf" || patient || q.trim().length < 2) return;
    const t = setTimeout(() => void api<{ patients: Pat[] }>(`/api/patients?q=${encodeURIComponent(q)}`).then((d) => setFound(d.ok ? d.patients.slice(0, 6) : [])), 250);
    return () => clearTimeout(t);
  }, [q, mode, patient]);

  const docs = o?.doctors.filter((d) => !poli || !d.poliklinikId || d.poliklinikId === poli) ?? [];
  const cur = o?.doctors.find((d) => d.id === doctor);
  const dateProblem = useCallback(() => {
    if (!date || !cur || !o) return "";
    const wd = new Date(`${date}T12:00:00+08:00`).getUTCDay();
    if (!cur.openDays.includes(wd)) return "Dokter tidak praktik pada hari ini.";
    if (cur.leave.includes(date)) return "Dokter cuti pada tanggal ini.";
    return "";
  }, [date, cur, o]);
  const payCfg = o?.paytypes.find((p) => p.id === pay);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const d = await api("/api/appointments", "POST", { doctorId: doctor, date, time, payTypeId: pay, payNumber: payNo || undefined, complaint: complaint || undefined, promoId: promoId || undefined, patientId: mode === "pasien" ? who || undefined : patient?.id });
    setBusy(false);
    if (!d.ok) {
      setMsg(d.message ?? "Gagal membuat janji.");
      if (d.code === "slot_taken" || d.code === "slot_held") (setTime(""), setTick((x) => x + 1));
      return;
    }
    onDone();
  }
  if (!o) return <div className="h-32 animate-pulse rounded-2xl bg-fg/5" aria-label="Memuat" />;
  if (!o.doctors.length) return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Belum ada dokter dengan jadwal praktik.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "staf" && (
        <div>
          <Field label="Pasien">
            {patient ? (
              <span className="mt-1.5 flex min-h-12 items-center justify-between rounded-xl border border-line px-4 text-sm"><span>{patient.name}{patient.rmNo && <span className="text-muted"> · RM {patient.rmNo}</span>}</span><button type="button" className="text-muted hover:text-fg" onClick={() => setPatient(undefined)}>Ganti</button></span>
            ) : <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, No. RM, NIK, atau HP" />}
          </Field>
          {!patient && found.length > 0 && <ul className="mt-1 divide-y divide-line rounded-xl border border-line text-sm">{found.map((p) => <li key={p.id}><button type="button" className="min-h-11 w-full px-4 text-left hover:bg-fg/5" onClick={() => (setPatient(p), setFound([]))}>{p.name}{p.rmNo && <span className="text-muted"> · RM {p.rmNo}</span>}</button></li>)}</ul>}
        </div>
      )}
      {mode === "pasien" && members.length > 1 && <Field label="Janji untuk"><Select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Saya sendiri</option>{members.filter((m) => m.relation !== "saya").map((m) => <option key={m.id} value={m.id}>{m.name} ({m.relation})</option>)}</Select></Field>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Poliklinik"><Select value={poli} onChange={(e) => (setPoli(e.target.value), setDoctor(""), setTime(""))}><option value="">Semua</option>{o.poliklinik.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Dokter"><Select value={doctor} onChange={(e) => (setDoctor(e.target.value), setTime(""))} required><option value="">Pilih dokter</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.poliklinikId ? ` · ${o.poliklinik.find((p) => p.id === d.poliklinikId)?.name ?? ""}` : ""}</option>)}</Select></Field>
        <Field label="Tanggal" hint={dateProblem() || `Maksimal ${o.rules.horizonDays} hari ke depan.`}><Input type="date" required value={date} min={witaToday()} max={addD(witaToday(), o.rules.horizonDays)} onChange={(e) => (setDate(e.target.value), setTime(""))} /></Field>
        <Field label="Jenis bayar"><Select value={pay} onChange={(e) => setPay(e.target.value)}>{o.paytypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      </div>
      {payCfg?.needsNumber && <Field label="Nomor kepesertaan"><Input value={payNo} onChange={(e) => setPayNo(e.target.value)} required /></Field>}
      {doctor && date && !dateProblem() && (
        <div><p className="mb-2 text-sm font-medium">Jam</p><SlotPicker doctorId={doctor} date={date} value={time} onPick={setTime} hold={mode === "pasien"} refresh={tick} />{mode === "pasien" && time && <p className="mt-2 text-xs text-muted">Jam ini kami tahan 5 menit untuk Anda.</p>}</div>
      )}
      {mode === "pasien" && promos.length > 0 && <Field label="Promo (opsional)" hint="Diskon dihitung otomatis di tagihan setelah tindakan."><Select value={promoId} onChange={(e) => setPromoId(e.target.value)}><option value="">Tanpa promo</option>{promos.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind === "percent" ? `${p.value}%` : p.kind === "amount" ? `Rp ${p.value.toLocaleString("id-ID")}` : "gratis"})</option>)}</Select></Field>}
      <Field label="Keluhan utama"><Input value={complaint} maxLength={300} onChange={(e) => setComplaint(e.target.value)} placeholder="Mis. sakit gigi geraham kiri" /></Field>
      <p role="alert" className="min-h-5 text-sm text-red-400">{msg}</p>
      <button className="btn btn-primary disabled:opacity-50" disabled={busy || !doctor || !date || !time || (mode === "staf" && !patient) || Boolean(dateProblem())}>{busy ? "Menyimpan…" : mode === "pasien" ? "Ajukan janji" : "Buat janji"}</button>
    </form>
  );
}
