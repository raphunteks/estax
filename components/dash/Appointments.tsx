"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookingForm, SlotPicker } from "./Booking";
import { fillWa } from "@/lib/site-helpers";
import { waPhone } from "@/lib/wa";
import { Badge, Card, Empty, Field, Input, Select, Skeleton, StatusBadge, Tabs, addD, api, fmtDate, witaToday } from "./kit";

export type A = { id: string; patientId: string; patientName: string; rmNo: string | null; doctorId: string; doctorName: string; date: string; time: string; endTime: string; status: string; complaint?: string; queueNo?: number; checkInAt?: number; calledAt?: number; payTypeId: string };
type Role = "superadmin" | "dokter" | "staf";
const staffRole = (r: Role) => r === "superadmin" || r === "staf";

function Reschedule({ a, onDone }: { a: A; onDone: () => void }) {
  const [date, setDate] = useState(a.date);
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState("");
  async function go() {
    const d = await api(`/api/appointments/${a.id}`, "PATCH", { action: "reschedule", date, time });
    if (d.ok) onDone();
    else setMsg(d.message ?? "Gagal mengubah jadwal.");
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line p-3">
      <Field label="Tanggal baru"><Input type="date" min={witaToday()} value={date} onChange={(e) => (setDate(e.target.value), setTime(""))} /></Field>
      <SlotPicker doctorId={a.doctorId} date={date} value={time} onPick={setTime} />
      <p role="alert" className="text-xs text-red-400">{msg}</p>
      <button className="btn btn-primary disabled:opacity-50" disabled={!time} onClick={go}>Simpan jadwal</button>
    </div>
  );
}

/** Buttons depend on status and role; the server enforces the same rules again. */
export function ApptActions({ a, role, userId, reload }: { a: A; role: Role; userId: string; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const staff = staffRole(role);
  const mineDoc = role === "dokter" && a.doctorId === userId;
  const run = async (action: string, note?: string) => {
    const d = await api(`/api/appointments/${a.id}`, "PATCH", { action, note });
    setMsg(d.ok ? "" : (d.message ?? "Gagal."));
    if (d.ok) reload();
  };
  const btn = (l: string, act: string, bad = false) => (
    <button key={act} className={`min-h-9 rounded-lg border px-3 text-xs transition-[transform,color] active:scale-[0.97] ${bad ? "border-red-400/40 text-red-300" : "border-line text-muted hover:text-fg"}`} onClick={() => void run(act)}>{l}</button>
  );
  const today = a.date === witaToday();
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {staff && a.status === "menunggu" && <>{btn("Terima","confirm")}{btn("Tolak","reject",true)}</>}
        {staff && ["menunggu", "dikonfirmasi"].includes(a.status) && today && btn("Check-in","checkin")}
        {(staff || mineDoc) && a.status === "checkin" && btn("Panggil","call")}
        {(staff || mineDoc) && a.status === "dipanggil" && btn("Panggil ulang","recall")}
        {(staff || mineDoc) && ["checkin", "dipanggil"].includes(a.status) && btn("Ke kursi","seat")}
        {(staff || mineDoc) && a.status === "dikursi" && btn("Selesai","done")}
        {staff && ["menunggu", "dikonfirmasi"].includes(a.status) && <button className="min-h-9 rounded-lg border border-line px-3 text-xs text-muted hover:text-fg" onClick={() => setOpen(!open)}>Ubah jadwal</button>}
        {staff && a.status === "dikonfirmasi" && <>{btn("Tidak hadir","noshow")}{btn("Batalkan","cancel",true)}</>}
      </div>
      {msg && <p role="alert" className="mt-1 text-xs text-red-400">{msg}</p>}
      {open && <Reschedule a={a} onDone={() => (setOpen(false), reload())} />}
    </div>
  );
}

const Row = ({ a, children }: { a: A; children?: React.ReactNode }) => (
  <li className="rounded-2xl border border-line p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><p className="font-medium">{a.patientName}{a.rmNo && <span className="text-xs text-muted"> · RM {a.rmNo}</span>}</p><p className="text-xs text-muted">{fmtDate(a.date)} · {a.time}–{a.endTime} · {a.doctorName}</p>{a.complaint && <p className="mt-1 text-sm">{a.complaint}</p>}</div>
      <StatusBadge s={a.status} />
    </div>
    {children}
  </li>
);

function useAppts(query: string) {
  const [rows, setRows] = useState<A[] | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    const d = await api<{ appointments: A[] }>(`/api/appointments?${query}`);
    d.ok ? (setRows(d.appointments), setErr(false)) : setErr(true);
  }, [query]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  return { rows, err, load };
}

function Requests({ role, userId }: { role: Role; userId: string }) {
  const { rows, err, load } = useAppts("status=menunggu");
  if (err) return <p className="text-sm text-red-400">Gagal memuat permintaan.</p>;
  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty>Tidak ada permintaan booking yang menunggu.</Empty>;
  return <ul className="space-y-3">{rows.map((a) => <Row key={a.id} a={a}><ApptActions a={a} role={role} userId={userId} reload={load} /></Row>)}</ul>;
}

const COLS: [string, string[]][] = [["Terjadwal", ["menunggu", "dikonfirmasi"]], ["Ruang tunggu", ["checkin"]], ["Dipanggil", ["dipanggil"]], ["Di kursi", ["dikursi"]], ["Selesai", ["selesai"]]];

type Wa = { hermes?: boolean; enabled: boolean; template: string; hoursBefore: number; clinic: string };
type AP = A & { patientPhone?: string };

function Reminders() {
  const [wa, setWa] = useState<Wa | null>(null);
  const [rows, setRows] = useState<AP[] | null>(null);
  const [err, setErr] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      const w = await api<Wa>("/api/site/wa");
      if (!live) return;
      if (!w.ok) return setErr(true);
      setWa(w);
      if (!w.enabled) return setRows([]);
      const t = witaToday();
      const days = Array.from({ length: Math.ceil(w.hoursBefore / 24) + 1 }, (_, i) => addD(t, i));
      const all = await Promise.all(days.map((d) => api<{ appointments: AP[] }>(`/api/appointments?date=${d}&status=dikonfirmasi`)));
      if (!live) return;
      if (all.some((r) => !r.ok)) return setErr(true);
      const now = Date.now();
      const list = all.flatMap((r) => r.appointments).filter((a) => {
        const at = new Date(`${a.date}T${a.time}:00+08:00`).getTime();
        return at > now && at - now <= w.hoursBefore * 3600e3;
      });
      setRows(list.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)));
    })();
    return () => void (live = false);
  }, []);
  if (err) return <p className="text-sm text-red-400">Gagal memuat pengingat.</p>;
  if (!wa || !rows) return <Skeleton />;
  if (!wa.enabled) return <Empty>Pengingat WhatsApp nonaktif. Aktifkan di Konten Situs, tab WhatsApp.</Empty>;
  if (!rows.length) return <Empty>Tidak ada janji dikonfirmasi dalam {wa.hoursBefore} jam ke depan.</Empty>;
  return (
    <Card title={`Janji dalam ${wa.hoursBefore} jam ke depan`}>
      {msg && <p role="status" className="mb-3 text-sm">{msg}</p>}
      <ul className="divide-y divide-fg/10">
        {rows.map((a) => {
          const phone = waPhone(a.patientPhone);
          const text = fillWa(wa.template, { nama: a.patientName, tanggal: fmtDate(a.date), jam: a.time, dokter: a.doctorName, klinik: wa.clinic });
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{a.patientName}</p>
                <p className="text-fg/60">{fmtDate(a.date)} {a.time} · {a.doctorName}</p>
              </div>
              {!phone ? (
                <Badge tone="warn">Tanpa nomor HP</Badge>
              ) : wa.hermes ? (
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={async () => {
                    setBusy(a.id);
                    const r = await api("/api/site/wa/send", "POST", { apptId: a.id });
                    setBusy("");
                    setMsg(r.ok ? `Terkirim ke ${a.patientName}.` : r.message ?? "Gagal mengirim.");
                    if (r.ok) setSent((x) => [...x, a.id]);
                  }}
                  className="rounded-full border border-accent/50 px-4 py-2 text-xs font-medium hover:bg-accent/10 disabled:opacity-50"
                >
                  {busy === a.id ? "Mengirim…" : sent.includes(a.id) ? "Terkirim ✓ (kirim lagi)" : "Kirim via Hermes"}
                </button>
              ) : (
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSent((x) => [...x, a.id])}
                  className="rounded-full border border-accent/50 px-4 py-2 text-xs font-medium hover:bg-accent/10"
                >
                  {sent.includes(a.id) ? "Dibuka ✓ (buka lagi)" : "Buka WhatsApp"}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Queue({ role, userId }: { role: Role; userId: string }) {
  const today = witaToday();
  const { rows, err, load } = useAppts(`date=${today}`);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") (void load(), setNow(Date.now()));
    }, 15000);
    return () => (clearTimeout(t0), clearInterval(t));
  }, [load]);
  if (err) return <p className="text-sm text-red-400">Gagal memuat antrian.</p>;
  if (!rows) return <Skeleton />;
  const live = rows.filter((a) => !a.status.startsWith("batal") && a.status !== "tidak_hadir");
  if (!live.length) return <Empty>Belum ada janji hari ini.</Empty>;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {COLS.map(([title, sts]) => (
        <section key={title} aria-label={title}>
          <h3 className="mb-2 flex items-center justify-between text-sm font-medium">{title}<Badge>{live.filter((a) => sts.includes(a.status)).length}</Badge></h3>
          <ul className="space-y-2">
            {live.filter((a) => sts.includes(a.status)).map((a) => (
              <li key={a.id} className="rounded-2xl border border-line p-3 text-sm">
                <p className="font-medium">{a.queueNo ? `#${a.queueNo} ` : ""}{a.patientName}</p>
                <p className="text-xs text-muted">{a.time} · {a.doctorName}</p>
                {a.status === "checkin" && a.checkInAt && now > 0 && <p className="mt-1 text-xs text-amber-300">menunggu {Math.max(0, Math.round((now - a.checkInAt) / 60000))} mnt</p>}
                <ApptActions a={a} role={role} userId={userId} reload={load} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type Cell = { start: string; end: string; state: string; apptId?: string; appt?: A | null };
type Day = { date: string; slots: Cell[] };
function Calendar({ role, userId, onBook }: { role: Role; userId: string; onBook: (p: { doctorId: string; date: string; time: string }) => void }) {
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [doctor, setDoctor] = useState(role === "dokter" ? userId : "");
  const [from, setFrom] = useState(() => witaToday());
  const [days, setDays] = useState<Day[] | null>(null);
  const [sel, setSel] = useState<A | null>(null);
  const [msg, setMsg] = useState("");
  const drag = useRef<A | null>(null);
  const staff = staffRole(role);

  useEffect(() => void api<{ doctors: { id: string; name: string }[] }>("/api/booking/options").then((d) => d.ok && (setDocs(d.doctors), !doctor && d.doctors[0] && setDoctor(d.doctors[0].id))), []); // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    if (!doctor) return;
    const d = await api<{ days: Day[] }>(`/api/calendar?doctor=${doctor}&from=${from}`);
    setDays(d.ok ? d.days : []);
  }, [doctor, from]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function drop(date: string, time: string) {
    const a = drag.current;
    drag.current = null;
    if (!a || !staff) return;
    const d = await api(`/api/appointments/${a.id}`, "PATCH", { action: "reschedule", date, time });
    setMsg(d.ok ? "Jadwal dipindahkan; pasien diberi tahu lewat email." : (d.message ?? "Tidak bisa dipindahkan."));
    void load();
  }
  const times = [...new Set((days ?? []).flatMap((d) => d.slots.filter((s) => s.state !== "past" || s.appt).map((s) => s.start)))].sort();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {role !== "dokter" && <div className="min-w-48"><Field label="Dokter"><Select value={doctor} onChange={(e) => setDoctor(e.target.value)}>{docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field></div>}
        <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setFrom(addD(from, -7))}>←</button><button className="btn btn-ghost" onClick={() => setFrom(witaToday())}>Hari ini</button><button className="btn btn-ghost" onClick={() => setFrom(addD(from, 7))}>→</button></div>
        <p role="status" className="text-xs text-muted">{msg}{!msg && staff && "Seret janji ke jam kosong untuk memindahkan, atau pilih janji lalu Ubah jadwal."}</p>
      </div>
      {!days ? <Skeleton /> : times.length === 0 ? <Empty>Tidak ada jam praktik pada pekan ini. Atur jadwal di Tim & Akses.</Empty> : (
        <div className="overflow-auto rounded-2xl border border-line" style={{ maxHeight: "65vh" }}>
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-surface"><tr><th className="w-16 p-2" />{days.map((d) => <th key={d.date} className="p-2 text-left font-medium">{fmtDate(d.date)}</th>)}</tr></thead>
            <tbody>
              {times.map((t) => (
                <tr key={t} className="border-t border-line">
                  <td className="p-2 align-top tabular-nums text-muted">{t}</td>
                  {days.map((d) => {
                    const c = d.slots.find((s) => s.start === t);
                    if (!c) return <td key={d.date} className="bg-fg/[0.03] p-1" />;
                    if (c.appt) return (
                      <td key={d.date} className="p-1">
                        <button draggable={staff && ["menunggu", "dikonfirmasi"].includes(c.appt.status)} onDragStart={() => (drag.current = c.appt!)} onClick={() => setSel(c.appt!)} className={`w-full rounded-lg border px-2 py-1.5 text-left transition-transform active:scale-[0.98] ${sel?.id === c.appt.id ? "border-accent bg-accent/15" : "border-line bg-fg/5"}`}>
                          <span className="block truncate font-medium">{c.appt.patientName}</span><span className="text-[10px] text-muted">{c.appt.status.replace("_", " ")}</span>
                        </button>
                      </td>
                    );
                    if (c.state === "free") return (
                      <td key={d.date} className="p-1" onDragOver={(e) => staff && e.preventDefault()} onDrop={() => void drop(d.date, t)}>
                        {staff ? <button className="h-8 w-full rounded-lg border border-dashed border-line text-muted/60 hover:border-accent hover:text-accent" aria-label={`Buat janji ${d.date} ${t}`} onClick={() => onBook({ doctorId: doctor, date: d.date, time: t })}>+</button> : <span className="block h-8 rounded-lg border border-dashed border-line" />}
                      </td>
                    );
                    return <td key={d.date} className="bg-fg/[0.03] p-1"><span className="block h-8" /></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sel && (
        <Card title={`${sel.patientName} · ${sel.time}`} right={<button className="text-sm text-muted hover:text-fg" onClick={() => setSel(null)}>Tutup</button>}>
          <p className="text-sm text-muted">{fmtDate(sel.date)} · {sel.doctorName}</p>
          <StatusBadge s={sel.status} />
          <ApptActions a={sel} role={role} userId={userId} reload={() => (setSel(null), void load())} />
        </Card>
      )}
    </div>
  );
}

export default function Appointments({ role, userId, patient, tab: initial }: { role: Role; userId: string; patient?: { id: string; name: string; rmNo: string | null }; tab?: string }) {
  const [tab, setTab] = useState(patient ? "new" : initial === "queue" || initial === "cal" || (initial === "req" && staffRole(role)) ? initial : staffRole(role) ? "req" : "cal");
  const [preset, setPreset] = useState<{ doctorId?: string; date?: string; time?: string }>();
  const [ok, setOk] = useState("");
  const tabs: [string, string][] = [...(staffRole(role) ? ([["req", "Permintaan"]] as [string, string][]) : []), ["queue", "Antrian hari ini"], ["cal", "Kalender"], ...(staffRole(role) ? ([["wa", "Pengingat"]] as [string, string][]) : []), ...(staffRole(role) ? ([["new", "Buat janji"]] as [string, string][]) : [])];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Janji & Antrian</h1>
        {<a href="/monitor-antrean-poliklinik" target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-10">Buka monitor TV poliklinik ↗</a>}
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(t) => (setTab(t), setOk(""))} />
      {ok && <p role="status" className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">{ok}</p>}
      {tab === "req" && <Requests role={role} userId={userId} />}
      {tab === "wa" && <Reminders />}
      {tab === "queue" && <Queue role={role} userId={userId} />}
      {tab === "cal" && <Calendar role={role} userId={userId} onBook={(p) => (setPreset(p), setTab("new"))} />}
      {tab === "new" && <Card title="Buat janji"><BookingForm key={JSON.stringify(preset)} mode="staf" presetPatient={patient} preset={preset} onDone={() => (setOk("Janji dibuat dan dikonfirmasi; pasien diberi tahu lewat email."), setPreset(undefined), setTab("queue"))} /></Card>}
    </div>
  );
}
