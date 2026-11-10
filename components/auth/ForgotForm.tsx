"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import { AuthShell, btnCls, inputCls } from "./ui";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const cap = useRef<ReCAPTCHA>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (SITE_KEY && !captcha) return setErr("Centang reCAPTCHA terlebih dahulu.");
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, captcha }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (d?.ok) setDone(true);
    else {
      setErr(d?.code === "rate_limited" ? "Terlalu banyak permintaan. Coba lagi nanti." : "Permintaan gagal. Coba lagi.");
      cap.current?.reset();
      setCaptcha(null);
    }
  }

  return (
    <AuthShell title="Lupa kata sandi" sub="Kami akan mengirim tautan untuk mengatur kata sandi baru.">
      {done ? (
        <div role="status" className="space-y-4 text-sm">
          <p>Jika email terdaftar, tautan pengaturan ulang sudah dikirim. Periksa kotak masuk dan folder spam. Tautan berlaku 1 jam.</p>
          <Link href="/masuk" className="btn btn-ghost w-full">
            Kembali ke halaman masuk
          </Link>
        </div>
      ) : (
        <form
          toolname="request_password_reset"
          tooldescription="Kirim tautan pengaturan ulang kata sandi ke alamat email akun Estaka Dental Clinic."
          onSubmit={submit}
          noValidate
        >
          <label className="au-in block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" toolparamdescription="Alamat email akun yang ingin diatur ulang kata sandinya." value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required className={inputCls} />
          {SITE_KEY && (
            <div className="mt-4 overflow-x-auto">
              <ReCAPTCHA ref={cap} sitekey={SITE_KEY} onChange={setCaptcha} onExpired={() => setCaptcha(null)} theme="dark" />
            </div>
          )}
          <p role="alert" className="mt-3 min-h-5 text-sm text-[var(--bad)]">
            {err}
          </p>
          <button className={`${btnCls} mt-3`} disabled={busy || !email}>
            {busy ? "Mengirim…" : "Kirim tautan"}
          </button>
          <Link href="/masuk" className="mt-4 block text-center text-sm text-muted underline-offset-4 hover:underline">
            Kembali
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
