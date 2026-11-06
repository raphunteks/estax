"use client";

import { useEffect, useState } from "react";
import { L } from "./L";
import { bookingCopy as c } from "@/lib/content";
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
    return { ok: false, message: "Koneksi bermasalah. Coba lagi atau hubungi kami lewat WhatsApp." } as { ok: boolean; message?: string } & Partial<T>;
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
  const closed = (iso: string): string | null => {
    if (days[0] && (iso < days[0] || iso > addDays(days[0], horizon))) return `Di luar rentang pemesanan (maks. ${horizon} hari ke depan)`;
    const list = doctor === "any" ? docs ?? [] : (docs ?? []).filter((d) => d.id === doctor);
    if (!list.length) return null;
    if (list.every((d) => d.off?.includes(iso))) return doctor === "any" ? "Semua dokter cuti" : "Dokter cuti";
    if (list.every((d) => d.off?.includes(iso) || (d.days && !d.days.includes(weekdayOf(iso))))) return "Tidak ada jam praktik";
    return null;
  };
  const maxDate = todayISO() ? addDays(todayISO(), horizon) : "";
  const fmt = (iso: string) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));
  const docName = docs?.find((d) => d.id === doctor)?.name ?? "dokter yang tersedia";

  async function verify() {
    setBusy(true); setErr("");
    const r = await post<{ token: string; name: string }>("/api/public/lookup", { ident: f.ident, birthDate: f.birthDate, phone4: f.phone4 });
    setBusy(false);
    if (r.ok && r.token && r.name) setWho({ token: r.token, name: r.name });
    else setErr(r.message ?? "Data tidak cocok.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const common = { doctorId: doctor, date, time, complaint: f.complaint, consent, website: f.website };
    const r = await post<Done>("/api/public/reserve", mode === "lama" ? { mode, token: who?.token, ...common } : { mode, nik: f.nik, name: f.name, birthDate: f.birthDate, gender: f.gender, phone: f.phone, address: f.address, allergies: f.allergies, ...common });
    setBusy(false);
    if (r.ok) setDone({ date: r.date ?? date, time: r.time ?? time, doctor: r.doctor ?? docName });
    else setErr(r.message ?? "Permintaan belum terkirim.");
  }

  const baruOk = f.nik.length === 16 && f.name.trim().length >= 3 && f.birthDate && f.phone.trim().length >= 9 && f.address.trim().length >= 5 && f.allergies.trim().length >= 1;
  const ready = Boolean(date && !closed(date) && time && f.complaint.trim().length >= 1 && consent && (mode === "lama" ? who : baruOk));
  const missing = [
    ...(mode === "lama" ? (who ? [] : ["verifikasi data pasien lama"]) : [
      ...(f.nik.length === 16 ? [] : ["NIK 16 digit"]), ...(f.name.trim().length >= 3 ? [] : ["nama lengkap"]), ...(f.birthDate ? [] : ["tanggal lahir"]),
      ...(f.phone.trim().length >= 9 ? [] : ["nomor WhatsApp"]), ...(f.address.trim().length >= 5 ? [] : ["alamat (min. 5 huruf)"]), ...(f.allergies.trim() ? [] : ["riwayat alergi (tulis Tidak ada atau -)"]),
    ]),
    ...(date && !closed(date) ? [] : ["tanggal yang tersedia"]), ...(time ? [] : ["jam"]), ...(f.complaint.trim() ? [] : ["keluhan (tulis - bila hanya kontrol)"]), ...(consent ? [] : ["persetujuan data"]),
  ];
  const wa = done ? waLink(`Halo Estaka Dental Clinic, saya sudah membuat janji ${fmt(done.date)} pukul ${done.time} dengan ${done.doctor}. Mohon konfirmasinya. Terima kasih.`) : null;

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
            <p className="mt-3 text-muted">{done.doctor ? `${done.doctor}, ` : ""}{fmt(done.date)} pukul {done.time} WITA. Janji Anda berstatus menunggu konfirmasi dari tim kami melalui WhatsApp.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary"><L v={c.sendWa} /></a>}
              <button type="button" onClick={() => { setDone(null); setDate(""); setTime(""); setConsent(false); setF((x) => ({ ...x, complaint: "" })); }} className="btn btn-ghost"><L v={c.again} /></button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="glass mt-10 space-y-8 rounded-3xl p-6 sm:p-8" noValidate data-reveal>
            <div role="tablist" aria-label="Jenis pasien" className="flex flex-wrap gap-2 border-b border-line pb-4">
              {([["baru", "Pasien baru"], ["lama", "Pasien lama (NIK / No RM)"]] as const).map(([m, t]) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(""); }} className={`press min-h-11 rounded-full border px-5 text-sm font-medium transition-colors ${mode === m ? "border-accent bg-accent text-accent-ink" : "border-line"}`}>{t}</button>
              ))}
            </div>

            {mode === "baru" ? (
              <fieldset className="grid gap-5 sm:grid-cols-2">
                <legend className="mb-3 text-sm font-semibold">1. Data pasien</legend>
                <label className={label}>Nomor Induk Kependudukan (NIK)<input id="bk-nik" name="nik" className={field} value={f.nik} onChange={(e) => setF((x) => ({ ...x, nik: e.target.value.replace(/\D/g, "").slice(0, 16) }))} inputMode="numeric" autoComplete="off" placeholder="16 digit NIK" /></label>
                <label className={label}>Nama lengkap<input id="bk-name" name="name" className={field} value={f.name} onChange={set("name")} maxLength={80} autoComplete="name" placeholder="Sesuai KTP" /></label>
                <label className={label}>Tanggal lahir<input type="date" id="bk-birthDate" name="birthDate" className={field} value={f.birthDate} onChange={set("birthDate")} autoComplete="bday" /></label>
                <label className={label}>Jenis kelamin<select id="bk-gender" name="gender" className={field} value={f.gender} onChange={set("gender")}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
                <label className={`${label} sm:col-span-2`}>Nomor WhatsApp aktif<input id="bk-phone" name="phone" className={field} value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" /></label>
              </fieldset>
            ) : (
              <fieldset className="space-y-5">
                <legend className="mb-3 text-sm font-semibold">1. Cari data pasien</legend>
                {who ? (
                  <p className="rounded-xl border border-accent/50 p-4 text-sm" role="status">Data ditemukan: <b>{who.name}</b>. Lanjutkan memilih dokter dan jadwal. <button type="button" className="ml-2 underline" onClick={() => setWho(null)}>Ganti</button></p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className={`${label} sm:col-span-2`}>NIK (16 digit) atau Nomor RM<input id="bk-ident" name="ident" className={field} value={f.ident} onChange={set("ident")} inputMode="numeric" autoComplete="off" /></label>
                    <label className={label}>Tanggal lahir<input type="date" id="bk-birthDateOld" name="birthDateOld" className={field} value={f.birthDate} onChange={set("birthDate")} /></label>
                    <label className={label}>4 digit terakhir nomor HP<input id="bk-phone4" name="phone4" className={field} value={f.phone4} onChange={(e) => setF((x) => ({ ...x, phone4: e.target.value.replace(/\D/g, "").slice(0, 4) }))} inputMode="numeric" autoComplete="off" /></label>
                    <div className="sm:col-span-2"><button type="button" onClick={verify} disabled={busy || f.ident.length < 4 || !f.birthDate || f.phone4.length !== 4} className="btn btn-ghost disabled:opacity-40">Cari data pasien</button></div>
                  </div>
                )}
              </fieldset>
            )}

            <fieldset>
              <legend className="mb-3 text-sm font-semibold">2. Dokter, tanggal, dan jam</legend>
              <label className={label}>Dokter gigi pemeriksa
                <select id="bk-doctor" name="doctor" className={field} value={doctor} onChange={(e) => setDoctor(e.target.value)} disabled={docs === null}>
                  <option value="any">Dokter mana saja yang tersedia</option>
                  {docs?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <p className="mt-5 mb-2 text-sm font-medium">Tanggal</p>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <label key={d}>
                    <input type="radio" name="date" value={d} checked={date === d} disabled={Boolean(closed(d))} onChange={() => setDate(d)} className="peer sr-only" />
                    <span className={`${chip} ${closed(d) ? "cursor-not-allowed line-through opacity-40" : ""}`} title={closed(d) ?? undefined}>{fmt(d)}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label htmlFor="bk-date" className="text-sm font-medium">Atau pilih tanggal lain</label>
                <input id="bk-date" name="customDate" type="date" min={days[0]} max={maxDate} value={date} className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent" onChange={(e) => setDate(e.target.value)} />
              </div>
              {date && closed(date) && <p role="alert" className="mt-2 text-sm text-[var(--bad)]">{closed(date)} pada tanggal ini. Silakan pilih tanggal lain.</p>}
              <p className="mt-5 mb-2 text-sm font-medium">Jam</p>
              {!date || closed(date) ? <p className="text-sm text-muted">Pilih tanggal yang tersedia terlebih dulu.</p> : slots === null ? <p className="text-sm text-muted" role="status">Memuat jadwal…</p> : slots.length === 0 ? <p className="text-sm text-muted">Tidak ada jadwal praktik pada tanggal ini. Coba tanggal lain.</p> : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <label key={s.start}>
                      <input type="radio" name="time" value={s.start} checked={time === s.start} disabled={!s.free} onChange={() => setTime(s.start)} className="peer sr-only" />
                      <span className={chip}>{s.start}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-5">
              <legend className="mb-1 text-sm font-semibold">3. Keluhan{mode === "baru" ? " dan keselamatan" : ""}</legend>
              {mode === "baru" && (
                <>
                  <label className={label}>Alamat domisili<input id="bk-address" name="address" className={field} value={f.address} onChange={set("address")} maxLength={200} autoComplete="address-line1" placeholder="Nama jalan, nomor rumah, kelurahan, kota" /></label>
                  <label className={label}>Riwayat alergi obat (penting untuk keselamatan Anda)<input id="bk-allergies" name="allergies" className={field} value={f.allergies} onChange={set("allergies")} maxLength={200} placeholder="Contoh: Amoxicillin, Asam Mefenamat, atau tulis Tidak ada" /></label>
                </>
              )}
              <label className={label}>Keluhan utama gigi atau gejala yang dialami<textarea id="bk-complaint" name="complaint" className={`${field} min-h-24 py-3`} value={f.complaint} onChange={set("complaint")} maxLength={300} placeholder="Nyeri, gigi ngilu, tambalan lepas, gusi bengkak, atau kebutuhan estetika" /></label>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={f.website} onChange={set("website")} />
              <label className="flex items-start gap-3 text-sm text-muted">
                <input type="checkbox" id="bk-consent" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
                <span><L v={c.consent} /></span>
              </label>
            </fieldset>

            <div aria-live="polite">
              {err && <p role="alert" className="mb-4 rounded-xl border border-line p-4 text-sm">{err}</p>}
              {missing.length > 0 && <p className="mb-3 text-sm text-muted" aria-live="polite">Lengkapi dulu: {missing.join(", ")}.</p>}
              <button type="submit" disabled={!ready || busy} className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{busy ? <L v={c.sending} /> : <L v={c.submit} />}</button>
              <p className="mt-4 text-xs text-muted"><L v={c.fine} /></p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
