"use client";

import { useEffect, useState } from "react";
import { BookingForm, SlotPicker } from "./Booking";
import { Card, Empty, Field, Input, Skeleton, StatusBadge, api, fmtDate, witaToday } from "./kit";
import type { A } from "./Appointments";

function Change({ a, onDone }: { a: A; onDone: () => void }) {
  const [date, setDate] = useState(a.date);
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState("");
  async function go() {
    const d = await api(`/api/appointments/${a.id}`, "PATCH", { action: "reschedule", date, time });
    d.ok ? onDone() : setMsg(d.message ?? "Gagal.");
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line p-3">
      <Field label="Tanggal baru"><Input type="date" min={witaToday()} value={date} onChange={(e) => (setDate(e.target.value), setTime(""))} /></Field>
      <SlotPicker doctorId={a.doctorId} date={date} value={time} onPick={setTime} />
      <p role="alert" className="text-xs text-red-400">{msg}</p>
      <button className="btn btn-primary disabled:opacity-50" disabled={!time} onClick={go}>Ajukan perubahan</button>
    </div>
  );
}

export default function PortalAppts({ noPatient }: { noPatient: boolean }) {
  const [rows, setRows] = useState<A[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [change, setChange] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api<{ appointments: A[] }>("/api/appointments/mine").then((d) => setRows(d.ok ? d.appointments : []));
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);
  async function cancel(id: string) {
    const d = await api(`/api/appointments/${id}`, "PATCH", { action: "cancel" });
    setMsg(d.ok ? "Janji dibatalkan." : (d.message ?? "Gagal membatalkan."));
    void load();
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Janji saya</h1>
        {!noPatient && <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}>{showNew ? "Tutup" : "Buat janji"}</button>}
      </div>
      {noPatient && <Empty>Data pasien Anda belum tersedia. Hubungi klinik.</Empty>}
      {showNew && <div className="mb-6"><Card title="Janji baru"><BookingForm mode="pasien" onDone={() => (setShowNew(false), setMsg("Permintaan dikirim. Kami akan mengonfirmasi lewat email."), void load())} /></Card></div>}
      {msg && <p role="status" className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">{msg}</p>}
      {!rows ? <Skeleton /> : rows.length === 0 ? (!noPatient && <Empty>Belum ada janji.</Empty>) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const editable = ["menunggu", "dikonfirmasi"].includes(a.status);
            return (
              <li key={a.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{fmtDate(a.date)} · {a.time}</p><p className="text-xs text-muted">{a.doctorName}</p>{a.complaint && <p className="mt-1 text-sm">{a.complaint}</p>}</div><StatusBadge s={a.status} /></div>
                {editable && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="min-h-9 rounded-lg border border-line px-3 text-xs text-muted hover:text-fg" onClick={() => setChange(change === a.id ? "" : a.id)}>Ubah jadwal</button>
                    <button className="min-h-9 rounded-lg border border-red-400/40 px-3 text-xs text-red-300" onClick={() => void cancel(a.id)}>Batalkan</button>
                  </div>
                )}
                {change === a.id && <Change a={a} onDone={() => (setChange(""), setMsg("Perubahan diajukan; menunggu konfirmasi klinik."), void load())} />}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">Perubahan dan pembatalan hanya bisa sampai batas waktu yang ditetapkan klinik. Setelah itu hubungi klinik lewat WhatsApp.</p>
    </div>
  );
}
