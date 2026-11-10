"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import type { ZodType } from "zod";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap-lite";
import Logo from "@/components/Logo";
import { ageOf } from "@/lib/nik";
import { CONDITIONS, credentials, staffPatientSchema, step1, step2, step3 } from "@/lib/patient-schema";
import { inputCls, shake } from "./ui";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const DRAFT = "estaka_reg_draft";
const DRAFT_KEYS = ["name", "email", "gender", "birthPlace", "birthDate", "phone", "province", "city", "district", "village", "postal", "address"];
type V = Record<string, string | boolean | string[]>;
const INIT: V = { idType: "wni", idNumber: "", name: "", email: "", gender: "", birthPlace: "", birthDate: "", phone: "", province: "", city: "", district: "", village: "", rt: "", rw: "", postal: "", address: "", landmark: "", occupation: "", bloodType: "", marital: "", allergies: "", conditions: [], conditionsOther: "", medications: "", pregnant: "", smoker: "tidak", emName: "", emRelation: "", emPhone: "", password: "", password2: "", consent: false };
const STEPS = ["Informasi pasien", "Alamat", "Kesehatan & akun"];
const today = new Date().toISOString().slice(0, 10);

function Fld({ k, label, err, hint, children }: { k: string; label: string; err?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={k} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && !err && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {err && <p id={`${k}-e`} role="alert" className="mt-1 text-xs text-red-400">{err}</p>}
    </div>
  );
}

export default function RegisterWizard({ staff = false }: { staff?: boolean }) {
  const [dup, setDup] = useState<{ name: string; rmNo: string | null; id: string } | null>(null);
  const [created, setCreated] = useState<{ id: string; rmNo: string | null; invited: boolean | null } | null>(null);
  const [step, setStep] = useState(0);
  const [v, setV] = useState<V>(INIT);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [top, setTop] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const cap = useRef<ReCAPTCHA>(null);
  const first = useRef(true);

  // Non-sensitive draft only (no ID number, health data or password), kept for this tab.
  useEffect(() => {
    if (staff) return;
    const t = setTimeout(() => {
      try {
        const d = JSON.parse(sessionStorage.getItem(DRAFT) ?? "null");
        if (d) setV((x) => ({ ...x, ...d }));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [staff]);
  useEffect(() => {
    if (staff) return;
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(DRAFT_KEYS.map((k) => [k, v[k]]))));
    } catch {}
  }, [v, staff]);

  useGSAP(
    () => {
      if (first.current) return void (first.current = false);
      gsap.matchMedia().add(MOTION_OK, () => void gsap.fromTo(".wz-step", { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: "power3.out", clearProps: "all" }));
    },
    { scope: root, dependencies: [step] },
  );

  const set = (k: string, val: string | boolean | string[]) => setV((x) => ({ ...x, [k]: val }));
  const text = (k: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={k} value={v[k] as string} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errs[k])} aria-describedby={errs[k] ? `${k}-e` : undefined} className={inputCls} {...extra} />
  );
  function check(schema: ZodType, data: V) {
    const r = schema.safeParse(data);
    if (r.success) return setErrs({}), true;
    const e: Record<string, string> = {};
    for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    setErrs(e);
    shake(root.current?.querySelector(".wz-step") as HTMLElement);
    return false;
  }
  function next() {
    if (step === 0) {
      // NIK/birth-date consistency is checked on the server schema too; here only the shared rules.
      const ok = check(staff ? staffPatientSchema.pick({ idType: true, idNumber: true, name: true, email: true, gender: true, birthPlace: true, birthDate: true, phone: true }) : step1, v);
      if (ok && v.idType === "wni" && !/^\d{16}$/.test(v.idNumber as string)) return setErrs({ idNumber: "NIK harus 16 digit." });
      if (!ok) return;
    } else if (step === 1 && !check(step2, v)) return;
    setErrs({});
    setStep(step + 1);
  }

  async function submit(e: React.FormEvent, force = false) {
    e.preventDefault();
    if (busy) return;
    if (!check(step3, v)) return;
    if (!staff) {
      if (v.password !== v.password2) return setErrs({ password2: "Konfirmasi kata sandi tidak sama." });
      if (!check(credentials, v)) return;
      if (SITE_KEY && !captcha) return setTop("Centang reCAPTCHA terlebih dahulu.");
    }
    setBusy(true);
    setTop("");
    const { password2: _p2, ...payload } = v;
    void _p2;
    const r = await fetch(staff ? "/api/patients" : "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(staff ? { ...payload, force } : { ...payload, captcha }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (staff && d?.code === "duplicate") return setDup(d.existing ?? { name: "pasien serupa", rmNo: null, id: "" });
    if (staff && d?.ok) return setCreated({ id: d.patient.id, rmNo: d.patient.rmNo, invited: d.invited });
    if (d?.ok) {
      try {
        sessionStorage.removeItem(DRAFT);
      } catch {}
      return setDone(true);
    }
    cap.current?.reset();
    setCaptcha(null);
    setTop(d?.code === "rate_limited" ? "Terlalu banyak percobaan. Coba lagi nanti." : (d?.message ?? "Pendaftaran gagal. Periksa isian Anda."));
    shake(root.current);
  }

  const age = v.birthDate ? ageOf(v.birthDate as string) : null;
  const toggleCond = (c: string) => set("conditions", (v.conditions as string[]).includes(c) ? (v.conditions as string[]).filter((x) => x !== c) : [...(v.conditions as string[]), c]);

  return (
    <main ref={root} className={staff ? "relative" : "relative min-h-dvh px-4 py-10"}>
      <div className="mx-auto w-full max-w-2xl">
        {staff ? (
          <h1 className="display text-3xl">Pasien baru</h1>
        ) : (
          <>
            <Link href="/" className="inline-flex items-center gap-2 text-accent" aria-label="Estaka Dental Clinic">
              <Logo size={34} />
              <span className="display text-2xl text-fg">Estaka</span>
            </Link>
            <h1 className="display mt-6 text-3xl sm:text-4xl">Daftar sebagai pasien</h1>
            <p className="mt-2 text-sm text-muted">Sudah punya akun? <Link href="/masuk" className="text-fg underline underline-offset-4">Masuk</Link></p>
          </>
        )}

        {created ? (
          <div role="status" className="glass mt-8 rounded-3xl p-7">
            <h2 className="display text-2xl">Pasien terdaftar</h2>
            <p className="mt-3 text-sm text-muted">No. RM <b className="text-fg">{created.rmNo}</b>. {created.invited ? "Undangan akun dikirim ke email pasien." : created.invited === false ? "Email undangan gagal terkirim; kirim ulang dari profil." : "Tanpa email, jadi belum ada akun portal."}</p>
            <Link href={`/dashboard/pasien/${created.id}`} className="btn btn-primary mt-6">Buka profil</Link>
          </div>
        ) : done ? (
          <div role="status" className="glass mt-8 rounded-3xl p-7">
            <h2 className="display text-2xl">Periksa email Anda</h2>
            <p className="mt-3 text-sm text-muted">Jika email belum terdaftar, tautan verifikasi sudah dikirim (berlaku 24 jam). Setelah diverifikasi Anda bisa masuk. Nomor rekam medis diterbitkan klinik saat Anda datang dengan membawa KTP.</p>
            <Link href="/masuk" className="btn btn-primary mt-6">Ke halaman masuk</Link>
          </div>
        ) : (
          <>
            <ol className="mt-8 flex gap-2" aria-label="Langkah pendaftaran">
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === step ? "step" : undefined} className="flex-1">
                  <div className={`h-1 rounded-full transition-colors duration-200 ${i <= step ? "bg-accent" : "bg-line"}`} />
                  <p className={`mt-2 text-xs ${i === step ? "text-fg" : "text-muted"}`}>{i + 1}. {s}</p>
                </li>
              ))}
            </ol>
            <form onSubmit={submit} noValidate className="glass mt-4 rounded-3xl p-6 sm:p-8">
              <div className="wz-step grid gap-4 sm:grid-cols-2">
                {!staff && <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-0 opacity-0" name="website" value={(v.website as string) ?? ""} onChange={(e) => set("website", e.target.value)} />}
                {step === 0 && (
                  <>
                    <Fld k="idType" err={errs.idType} label="Kewarganegaraan">
                      <select id="idType" value={v.idType as string} onChange={(e) => set("idType", e.target.value)} className={inputCls}><option value="wni">WNI (NIK)</option><option value="wna">WNA (paspor)</option></select>
                    </Fld>
                    <Fld k="idNumber" err={errs.idNumber} label={v.idType === "wni" ? "NIK (16 digit)" : "Nomor paspor"} hint="Disimpan terenkripsi dan hanya tampil sebagian.">{text("idNumber", { inputMode: v.idType === "wni" ? "numeric" : "text", maxLength: v.idType === "wni" ? 16 : 20, autoComplete: "off" })}</Fld>
                    <div className="sm:col-span-2"><Fld k="name" err={errs.name} label="Nama lengkap">{text("name", { autoComplete: "name" })}</Fld></div>
                    <Fld k="email" err={errs.email} label={staff ? "Email (opsional, untuk akun portal)" : "Email"}>{text("email", { type: "email", autoComplete: "email" })}</Fld>
                    <Fld k="phone" err={errs.phone} label="No. HP (WhatsApp)">{text("phone", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "0812…" })}</Fld>
                    <Fld k="gender" err={errs.gender} label="Jenis kelamin">
                      <select id="gender" value={v.gender as string} onChange={(e) => set("gender", e.target.value)} className={inputCls}><option value="">Pilih</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
                    </Fld>
                    <Fld k="birthPlace" err={errs.birthPlace} label="Tempat lahir">{text("birthPlace")}</Fld>
                    <div className="sm:col-span-2">
                      <Fld k="birthDate" err={errs.birthDate} label="Tanggal lahir" hint={age !== null && age >= 0 ? `Usia ${age} tahun${age < 17 ? ". Pasien anak: data wali diisi di langkah 3." : age >= 60 ? ". Pasien lansia: disarankan mencantumkan pendamping." : ""}` : undefined}>
                        {text("birthDate", { type: "date", min: "1900-01-01", max: today })}
                      </Fld>
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <Fld k="province" err={errs.province} label="Provinsi">{text("province")}</Fld>
                    <Fld k="city" err={errs.city} label="Kabupaten/Kota">{text("city")}</Fld>
                    <Fld k="district" err={errs.district} label="Kecamatan">{text("district")}</Fld>
                    <Fld k="village" err={errs.village} label="Kelurahan/Desa">{text("village")}</Fld>
                    <Fld k="rt" err={errs.rt} label="RT">{text("rt", { maxLength: 4 })}</Fld>
                    <Fld k="rw" err={errs.rw} label="RW">{text("rw", { maxLength: 4 })}</Fld>
                    <Fld k="postal" err={errs.postal} label="Kode pos">{text("postal", { inputMode: "numeric", maxLength: 5 })}</Fld>
                    <Fld k="landmark" err={errs.landmark} label="Patokan (opsional)">{text("landmark")}</Fld>
                    <div className="sm:col-span-2"><Fld k="address" err={errs.address} label="Alamat lengkap">{text("address", { autoComplete: "street-address" })}</Fld></div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <p className="text-sm text-muted sm:col-span-2">Informasi ini membantu dokter merawat Anda dengan aman. Kosongkan bila tidak ada.</p>
                    <Fld k="allergies" err={errs.allergies} label="Alergi (obat, lateks, makanan)">{text("allergies")}</Fld>
                    <Fld k="medications" err={errs.medications} label="Obat rutin">{text("medications")}</Fld>
                    <fieldset className="sm:col-span-2">
                      <legend className="text-sm font-medium">Riwayat penyakit</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {CONDITIONS.map((c) => {
                          const on = (v.conditions as string[]).includes(c);
                          return <button type="button" key={c} aria-pressed={on} onClick={() => toggleCond(c)} className={`min-h-10 rounded-full border px-4 text-sm capitalize transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${on ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-fg"}`}>{c}</button>;
                        })}
                      </div>
                    </fieldset>
                    <Fld k="conditionsOther" err={errs.conditionsOther} label="Penyakit lain">{text("conditionsOther")}</Fld>
                    <Fld k="smoker" err={errs.smoker} label="Merokok"><select id="smoker" value={v.smoker as string} onChange={(e) => set("smoker", e.target.value)} className={inputCls}><option value="tidak">Tidak</option><option value="kadang">Kadang</option><option value="ya">Ya</option></select></Fld>
                    <Fld k="bloodType" err={errs.bloodType} label="Golongan darah"><select id="bloodType" value={v.bloodType as string} onChange={(e) => set("bloodType", e.target.value)} className={inputCls}><option value="">Tidak tahu</option>{["A", "B", "AB", "O"].map((b) => <option key={b}>{b}</option>)}</select></Fld>
                    {v.gender === "P" && <Fld k="pregnant" err={errs.pregnant} label="Kondisi khusus"><select id="pregnant" value={v.pregnant as string} onChange={(e) => set("pregnant", e.target.value)} className={inputCls}><option value="">Tidak ada</option><option value="hamil">Hamil</option><option value="menyusui">Menyusui</option></select></Fld>}
                    <Fld k="occupation" err={errs.occupation} label="Pekerjaan (opsional)">{text("occupation")}</Fld>
                    <Fld k="emName" err={errs.emName} label={age !== null && age < 17 ? "Nama wali" : "Kontak darurat"}>{text("emName")}</Fld>
                    <Fld k="emRelation" err={errs.emRelation} label="Hubungan">{text("emRelation")}</Fld>
                    <Fld k="emPhone" err={errs.emPhone} label="No. HP kontak">{text("emPhone", { type: "tel", inputMode: "tel" })}</Fld>
                    {!staff && <hr className="border-line sm:col-span-2" />}
                    {!staff && <Fld k="password" err={errs.password} label="Kata sandi" hint="Minimal 10 karakter, huruf dan angka.">{text("password", { type: "password", autoComplete: "new-password" })}</Fld>}
                    {!staff && <Fld k="password2" err={errs.password2} label="Ulangi kata sandi">{text("password2", { type: "password", autoComplete: "new-password" })}</Fld>}
                    {!staff && <div className="sm:col-span-2">
                      <label className="flex items-start gap-3 text-sm">
                        <input name="registerwizard-input-230" type="checkbox" checked={v.consent as boolean} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                        <span>Saya menyatakan data benar dan menyetujui klinik memproses data kesehatan saya untuk keperluan pelayanan.</span>
                      </label>
                      {errs.consent && <p role="alert" className="mt-1 text-xs text-red-400">{errs.consent}</p>}
                    </div>}
                    {!staff && SITE_KEY && <div className="overflow-x-auto sm:col-span-2"><ReCAPTCHA ref={cap} sitekey={SITE_KEY} onChange={setCaptcha} onExpired={() => setCaptcha(null)} theme="dark" /></div>}
                  </>
                )}
              </div>
              {dup && (
                <div role="alert" className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
                  Pasien serupa sudah terdaftar: <b>{dup.name}</b>{dup.rmNo ? ` (RM ${dup.rmNo})` : ""}.
                  <span className="mt-2 flex flex-wrap gap-2">
                    {dup.id && <Link href={`/dashboard/pasien/${dup.id}`} className="btn btn-ghost">Buka yang ada</Link>}
                    <button type="button" className="btn btn-ghost" onClick={(e) => (setDup(null), void submit(e as unknown as React.FormEvent, true))}>Tetap daftarkan baru</button>
                  </span>
                </div>
              )}
              <p role="alert" className="mt-3 min-h-5 text-sm text-red-400">{top}</p>
              <div className="mt-4 flex justify-between gap-3">
                <button type="button" onClick={() => (setErrs({}), setStep(step - 1))} disabled={step === 0} className="btn btn-ghost disabled:invisible">Kembali</button>
                {step < 2 ? <button key="next" type="button" onClick={next} className="btn btn-primary">Lanjut</button> : <button key="submit" className="btn btn-primary disabled:opacity-50" disabled={busy}>{busy ? "Mengirim…" : "Daftar"}</button>}
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
