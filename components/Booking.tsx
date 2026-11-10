"use client";

import { useEffect, useState } from "react";
import { L } from "./L";
import { bookingCopy as c, type Bi } from "@/lib/content";
import { addDays, todayISO } from "@/lib/schedule";

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
import { useLang } from "@/lib/lang";
import { waLink } from "@/lib/wa";

type Doc = { id: string; name: string; days?: number[]; off?: string[] };
type Slot = { start: string; free: boolean };
type Mode = "baru" | "lama";
type Done = { date: string; time: string; doctor: string };

const chip =
  "press inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] peer-disabled:cursor-not-allowed peer-disabled:opacity-35 hover:border-accent";
const field = "mt-2 min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-base outline-none transition-colors focus:border-accent";
const label = "block text-sm font-medium";

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; message?: string } & Partial<T>> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, message: undefined } as { ok: boolean; message?: string } & Partial<T>;
  }
}

export default function Booking() {
  const lang = useLang();
  const [mode, setMode] = useState<Mode>("baru");
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [horizon, setHorizon] = useState(14);
  const [doctor, setDoctor] = useState("any");
  const [days, setDays] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState("");
  const [f, setF] = useState({ nik: "", name: "", birthDate: "", gender: "L", phone: "", address: "", allergies: "", complaint: "", ident: "", phone4: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [who, setWho] = useState<{ token: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [want, setWant] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Dates depend on the visitor's clock, so compute after mount to avoid a hydration mismatch.
  useEffect(() => {
    const t = todayISO();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(Array.from({ length: 14 }, (_, i) => addDays(t, i)));
    void fetch("/api/public/doctors").then((r) => r.json()).then((d: { ok?: boolean; doctors?: Doc[]; horizon?: number }) => {
      if (d.horizon) setHorizon(d.horizon);
      const list = d.doctors ?? [];
      setDocs(list);
      setWant((w) => w ?? new URLSearchParams(location.search).get("dokter"));
    }).catch(() => setDocs([]));
    const onDoc = (e: Event) => setWant(String((e as CustomEvent).detail));
    window.addEventListener("estaka:doctor", onDoc);
    return () => window.removeEventListener("estaka:doctor", onDoc);
  }, []);

  // Preselect the doctor chosen on the slider once the list is known.
  useEffect(() => {
    const w = want?.toLowerCase();
    const hit = w && docs ? docs.find((x) => x.name.toLowerCase().includes(w) || w.includes(x.name.toLowerCase().replace(/^drg\.?\s*/, ""))) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hit) setDoctor(hit.id);
  }, [want, docs]);

  // Times come from the real doctor schedule and bookings.
  useEffect(() => {
    if (!date) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(null);
    setTime("");
    void fetch(`/api/public/slots?doctor=${doctor}&date=${date}`).then((r) => r.json()).then((d: { slots?: Slot[] }) => live && setSlots(d.slots ?? [])).catch(() => live && setSlots([]));
    return () => {
      live = false;
    };
  }, [date, doctor]);

  /** Why a date cannot be booked for the chosen doctor (or for every doctor when "any"), or null when it can. */
  const closed = (iso: string): Bi | null => {
    if (days[0] && (iso < days[0] || iso > addDays(days[0], horizon))) return c.closedOutsideRange(horizon);
    const list = doctor === "any" ? docs ?? [] : (docs ?? []).filter((d) => d.id === doctor);
    if (!list.length) return null;
    if (list.every((d) => d.off?.includes(iso))) return doctor === "any" ? c.closedAllOff : c.closedDocOff;
    if (list.every((d) => d.off?.includes(iso) || (d.days && !d.days.includes(weekdayOf(iso))))) return c.closedNoSchedule;
    return null;
  };
  const maxDate = todayISO() ? addDays(todayISO(), horizon) : "";
  const fmt = (iso: string) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));
  const docName = docs?.find((d) => d.id === doctor)?.name ?? (lang === "en" ? "available dentist" : "dokter yang tersedia");

  async function verify() {
    setBusy(true); setErr("");
    const r = await post<{ token: string; name: string }>("/api/public/lookup", { ident: f.ident, birthDate: f.birthDate, phone4: f.phone4 });
    setBusy(false);
    if (r.ok && r.token && r.name) setWho({ token: r.token, name: r.name });
    else setErr(r.message ?? (lang === "en" ? c.matchError.en : c.matchError.id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const common = { doctorId: doctor, date, time, complaint: f.complaint, consent, website: f.website };
    const r = await post<Done>("/api/public/reserve", mode === "lama" ? { mode, token: who?.token, ...common } : { mode, nik: f.nik, name: f.name, birthDate: f.birthDate, gender: f.gender, phone: f.phone, address: f.address, allergies: f.allergies, ...common });
    setBusy(false);
    if (r.ok) setDone({ date: r.date ?? date, time: r.time ?? time, doctor: r.doctor ?? docName });
    else setErr(r.message ?? (lang === "en" ? c.failError.en : c.failError.id));
  }

  const baruOk = f.nik.length === 16 && f.name.trim().length >= 3 && f.birthDate && f.phone.trim().length >= 9 && f.address.trim().length >= 5 && f.allergies.trim().length >= 1;
  const ready = Boolean(date && !closed(date) && time && f.complaint.trim().length >= 1 && consent && (mode === "lama" ? who : baruOk));
  const missing: Bi[] = [
    ...(mode === "lama" ? (who ? [] : [c.missingVerification]) : [
      ...(f.nik.length === 16 ? [] : [c.missingNik]), ...(f.name.trim().length >= 3 ? [] : [c.missingName]), ...(f.birthDate ? [] : [c.missingBirthDate]),
      ...(f.phone.trim().length >= 9 ? [] : [c.missingPhone]), ...(f.address.trim().length >= 5 ? [] : [c.missingAddress]), ...(f.allergies.trim() ? [] : [c.missingAllergies]),
    ]),
    ...(date && !closed(date) ? [] : [c.missingDate]), ...(time ? [] : [c.missingTime]), ...(f.complaint.trim() ? [] : [c.missingComplaint]), ...(consent ? [] : [c.missingConsent]),
  ];
  const wa = done
    ? waLink(
        lang === "en"
          ? `Hello Estaka Dental Clinic, I have scheduled an appointment on ${fmt(done.date)} at ${done.time} with ${done.doctor}. Please confirm. Thank you.`
          : `Halo Estaka Dental Clinic, saya sudah membuat janji ${fmt(done.date)} pukul ${done.time} dengan ${done.doctor}. Mohon konfirmasinya. Terima kasih.`
      )
    : null;

  return (
    <section id="reservasi" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div data-reveal>
          <p className="eyebrow"><L v={c.eyebrow} /></p>
          <h2 className="display mt-4 text-[clamp(2.2rem,5vw,3.8rem)]"><L v={c.title} /></h2>
          <p className="mt-4 text-muted"><L v={c.sub} /></p>
        </div>

        {done ? (
          <div className="glass mt-10 rounded-3xl p-8" role="status">
            <h3 className="display text-3xl"><L v={c.doneTitle} /></h3>
            <p className="mt-3 text-muted">
              {done.doctor ? `${done.doctor}, ` : ""}
              {fmt(done.date)}{" "}
              <L v={c.doneAt} /> {done.time}{" "}
              <L v={c.doneStatus} />
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary"><L v={c.sendWa} /></a>}
              <button type="button" onClick={() => { setDone(null); setDate(""); setTime(""); setConsent(false); setF((x) => ({ ...x, complaint: "" })); }} className="btn btn-ghost"><L v={c.again} /></button>
            </div>
          </div>
        ) : (
          <form
            id="booking-form"
            toolname="book_appointment"
            tooldescription="Formulir reservasi janji temu dokter gigi online di Estaka Dental Clinic Makassar."
            onSubmit={submit}
            className="glass mt-10 space-y-8 rounded-3xl p-6 sm:p-8"
            noValidate
            data-reveal
          >
            <div role="group" aria-label={lang === "en" ? c.patientTypeLabel.en : c.patientTypeLabel.id} className="flex flex-wrap gap-2 border-b border-line pb-4">
              {([["baru", c.tabNew], ["lama", c.tabReturning]] as const).map(([m, t]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setErr(""); }} className={`press min-h-11 rounded-full border px-5 text-sm font-medium transition-colors ${mode === m ? "border-accent bg-accent text-accent-ink" : "border-line"}`}>
                  <L v={t} />
                </button>
              ))}
            </div>

            {mode === "baru" ? (
              <fieldset className="grid gap-5 sm:grid-cols-2">
                <legend className="mb-3 text-sm font-semibold"><L v={c.legendPatientData} /></legend>
                <label className={label}>
                  <L v={c.nikLabel} />
                  <input id="bk-nik" name="nik" toolparamdescription="Nomor Induk Kependudukan (NIK 16 digit) pasien baru." className={field} value={f.nik} onChange={(e) => setF((x) => ({ ...x, nik: e.target.value.replace(/\D/g, "").slice(0, 16) }))} inputMode="numeric" autoComplete="off" placeholder={lang === "en" ? c.nikPlaceholder.en : c.nikPlaceholder.id} />
                </label>
                <label className={label}>
                  <L v={c.nameLabel} />
                  <input id="bk-name" name="name" toolparamdescription="Nama lengkap pasien sesuai identitas." className={field} value={f.name} onChange={set("name")} maxLength={80} autoComplete="name" placeholder={lang === "en" ? c.namePlaceholder.en : c.namePlaceholder.id} />
                </label>
                <label className={label}>
                  <L v={c.birthDateLabel} />
                  <input type="date" id="bk-birthDate" name="birthDate" toolparamdescription="Tanggal lahir pasien (YYYY-MM-DD)." className={field} value={f.birthDate} onChange={set("birthDate")} autoComplete="bday" />
                </label>
                <label className={label}>
                  <L v={c.genderLabel} />
                  <select id="bk-gender" name="gender" toolparamdescription="Jenis kelamin pasien (L untuk Laki-laki, P untuk Perempuan)." className={field} value={f.gender} onChange={set("gender")}>
                    <option value="L">{lang === "en" ? c.genderMale.en : c.genderMale.id}</option>
                    <option value="P">{lang === "en" ? c.genderFemale.en : c.genderFemale.id}</option>
                  </select>
                </label>
                <label className={`${label} sm:col-span-2`}>
                  <L v={c.phoneLabel} />
                  <input id="bk-phone" name="phone" toolparamdescription="Nomor telepon atau WhatsApp aktif pasien." className={field} value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder={lang === "en" ? c.phonePlaceholder.en : c.phonePlaceholder.id} />
                </label>
              </fieldset>
            ) : (
              <fieldset className="space-y-5">
                <legend className="mb-3 text-sm font-semibold"><L v={c.legendLookupPatient} /></legend>
                {who ? (
                  <p className="rounded-xl border border-accent/50 p-4 text-sm" role="status">
                    <L v={c.foundData} /> <b>{who.name}</b><L v={c.foundContinue} />
                    <button type="button" className="ml-2 underline" onClick={() => setWho(null)}><L v={c.changePatient} /></button>
                  </p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className={`${label} sm:col-span-2`}>
                      <L v={c.identLabel} />
                      <input id="bk-ident" name="ident" toolparamdescription="Nomor Rekam Medis (No. RM) atau NIK pasien lama." className={field} value={f.ident} onChange={set("ident")} inputMode="numeric" autoComplete="off" />
                    </label>
                    <label className={label}>
                      <L v={c.birthDateOldLabel} />
                      <input type="date" id="bk-birthDateOld" name="birthDateOld" toolparamdescription="Tanggal lahir pasien lama untuk verifikasi (YYYY-MM-DD)." className={field} value={f.birthDate} onChange={set("birthDate")} />
                    </label>
                    <label className={label}>
                      <L v={c.phone4Label} />
                      <input id="bk-phone4" name="phone4" toolparamdescription="4 digit terakhir nomor telepon pasien lama." className={field} value={f.phone4} onChange={(e) => setF((x) => ({ ...x, phone4: e.target.value.replace(/\D/g, "").slice(0, 4) }))} inputMode="numeric" autoComplete="off" />
                    </label>
                    <div className="sm:col-span-2">
                      <button type="button" onClick={verify} disabled={busy || f.ident.length < 4 || !f.birthDate || f.phone4.length !== 4} className="btn btn-ghost disabled:opacity-40">
                        <L v={c.lookupBtn} />
                      </button>
                    </div>
                  </div>
                )}
              </fieldset>
            )}

            <fieldset>
              <legend className="mb-3 text-sm font-semibold"><L v={c.legendDoctorDateTime} /></legend>
              <label className={label}>
                <L v={c.doctorSelectLabel} />
                <select id="bk-doctor" name="doctor" toolparamdescription="ID dokter gigi yang dipilih atau 'any' untuk dokter yang tersedia." className={field} value={doctor} onChange={(e) => setDoctor(e.target.value)} disabled={docs === null}>
                  <option value="any">{lang === "en" ? c.anyDoctor.en : c.anyDoctor.id}</option>
                  {docs?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <p className="mt-5 mb-2 text-sm font-medium"><L v={c.dateHeading} /></p>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => {
                  const cl = closed(d);
                  return (
                    <label key={d}>
                      <input type="radio" name="date" value={d} toolparamdescription={`Pilih tanggal kunjungan ${d}.`} checked={date === d} disabled={Boolean(cl)} onChange={() => setDate(d)} className="peer sr-only" />
                      <span className={`${chip} ${cl ? "cursor-not-allowed line-through opacity-40" : ""}`} title={cl ? (lang === "en" ? cl.en : cl.id) : undefined}>{fmt(d)}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label htmlFor="bk-date" className="text-sm font-medium"><L v={c.customDateLabel} /></label>
                <input id="bk-date" name="customDate" type="date" toolparamdescription="Tanggal kunjungan pilihan (YYYY-MM-DD)." min={days[0]} max={maxDate} value={date} className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent" onChange={(e) => setDate(e.target.value)} />
              </div>
              {date && closed(date) && (
                <p role="alert" className="mt-2 text-sm text-[var(--bad)]">
                  <L v={closed(date)!} /> <L v={c.closedOnDate} />
                </p>
              )}
              <p className="mt-5 mb-2 text-sm font-medium"><L v={c.timeHeading} /></p>
              {!date || closed(date) ? (
                <p className="text-sm text-muted"><L v={c.selectDateFirst} /></p>
              ) : slots === null ? (
                <p className="text-sm text-muted" role="status"><L v={c.loadingSchedule} /></p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted"><L v={c.noSlotsOnDate} /></p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <label key={s.start}>
                      <input type="radio" name="time" value={s.start} toolparamdescription={`Jam kedatangan ${s.start} WITA.`} checked={time === s.start} disabled={!s.free} onChange={() => setTime(s.start)} className="peer sr-only" />
                      <span className={chip}>{s.start}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-5">
              <legend className="mb-1 text-sm font-semibold">
                <L v={mode === "baru" ? c.legendComplaintSafety : c.legendComplaintOnly} />
              </legend>
              {mode === "baru" && (
                <>
                  <label className={label}>
                    <L v={c.addressLabel} />
                    <input id="bk-address" name="address" toolparamdescription="Alamat tempat tinggal pasien saat ini." className={field} value={f.address} onChange={set("address")} maxLength={200} autoComplete="address-line1" placeholder={lang === "en" ? c.addressPlaceholder.en : c.addressPlaceholder.id} />
                  </label>
                  <label className={label}>
                    <L v={c.allergiesLabel} />
                    <input id="bk-allergies" name="allergies" toolparamdescription="Riwayat alergi obat atau makanan (kosongkan jika tidak ada)." className={field} value={f.allergies} onChange={set("allergies")} maxLength={200} placeholder={lang === "en" ? c.allergiesPlaceholder.en : c.allergiesPlaceholder.id} />
                  </label>
                </>
              )}
              <label className={label}>
                <L v={c.complaintLabel} />
                <textarea id="bk-complaint" name="complaint" toolparamdescription="Keluhan gigi dan mulut atau perawatan yang diinginkan." className={`${field} min-h-24 py-3`} value={f.complaint} onChange={set("complaint")} maxLength={300} placeholder={lang === "en" ? c.complaintPlaceholder.en : c.complaintPlaceholder.id} />
              </label>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" aria-label="Website" toolparamdescription="Jangan diisi (proteksi spam)." className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={f.website} onChange={set("website")} />
              <label className="flex items-start gap-3 text-sm text-muted">
                <input type="checkbox" id="bk-consent" name="consent" toolparamdescription="Persetujuan pemrosesan data reservasi klinik." checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
                <span><L v={c.consent} /></span>
              </label>
            </fieldset>

            <div aria-live="polite">
              {err && <p role="alert" className="mb-4 rounded-xl border border-line p-4 text-sm">{err}</p>}
              {missing.length > 0 && (
                <p className="mb-3 text-sm text-muted" aria-live="polite">
                  <L v={c.completeFirst} />
                  {missing.map((m, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      <L v={m} />
                    </span>
                  ))}
                  .
                </p>
              )}
              <button type="submit" disabled={!ready || busy} className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{busy ? <L v={c.sending} /> : <L v={c.submit} />}</button>
              <p className="mt-4 text-xs text-muted"><L v={c.fine} /></p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
