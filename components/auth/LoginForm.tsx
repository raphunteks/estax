"use client";

import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import { AuthShell, btnCls, inputCls, shake } from "./ui";

const MESSAGES: Record<string, string> = {
  invalid: "Email atau kata sandi salah.",
  locked: "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
  rate_limited: "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
  captcha: "Verifikasi reCAPTCHA gagal. Centang kotaknya lalu coba lagi.",
  unverified: "Email belum diverifikasi. Periksa kotak masuk Anda untuk tautan verifikasi.",
  expired: "Sesi verifikasi berakhir. Masuk ulang.",
  validation: "Periksa kembali isian Anda.",
};
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function LoginForm({ next }: { next?: string }) {
  const [step, setStep] = useState<"cred" | "totp">("cred");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const card = useRef<HTMLFormElement>(null);
  const cap = useRef<ReCAPTCHA>(null);
  const [unverified, setUnverified] = useState(false);
  const [pk, setPk] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPk(browserSupportsWebAuthn()), 0); return () => clearTimeout(t); }, []);
  const [sentMsg, setSentMsg] = useState("");

  const go = (path: string) => {
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    window.location.assign(path.endsWith("/akun") ? path : (safe ?? path)); // hard nav so the layout re-reads the new session
  };
  async function resend() {
    const r = await fetch("/api/auth/verify", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, captcha }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSentMsg(d?.ok ? "Jika akun ada, tautan baru sudah dikirim." : MESSAGES[d?.code] ?? "Gagal mengirim.");
    cap.current?.reset();
    setCaptcha(null);
  }
  const bad = (code: string) => {
    setUnverified(code === "unverified");
    setErr(MESSAGES[code] ?? "Terjadi kesalahan. Coba lagi.");
    shake(card.current);
    cap.current?.reset();
    setCaptcha(null);
  };

  async function submitCred(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (SITE_KEY && !captcha) return bad("captcha");
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, captcha }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (!d?.ok) return bad(d?.code ?? "default");
    if (d.step === "totp") {
      setStep("totp");
      setPassword("");
    } else go(d.next);
  }

  async function passkey() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const o = await fetch("/api/passkey/login/options", { method: "POST" }).then((x) => x.json());
      if (!o.ok) throw new Error(o.message);
      const response = await startAuthentication({ optionsJSON: o.options });
      const d = await fetch("/api/passkey/login/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: o.token, response }) }).then((x) => x.json());
      if (!d.ok) { setErr(d.message ?? "Passkey ditolak."); setBusy(false); return; }
      go(d.next);
    } catch { setErr("Passkey dibatalkan atau tidak tersedia."); setBusy(false); }
  }

  async function submitCode(value: string) {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: value }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (!d?.ok) {
      setCode("");
      const msg = d?.message || (d?.code === "invalid" ? "Kode verifikasi salah atau sudah dipakai." : (MESSAGES[d?.code] ?? "Kode verifikasi salah atau kedaluwarsa. Silakan coba lagi."));
      setErr(msg);
      shake(card.current);
      if (d?.code === "expired") setStep("cred");
      return;
    }
    go(d.next);
  }

  if (step === "totp")
    return (
      <AuthShell title="Kode verifikasi" sub="Masukkan 6 digit dari aplikasi authenticator Anda, atau satu kode cadangan.">
        <form
          ref={card}
          toolname="verify_totp_code"
          tooldescription="Verifikasi kode autentikasi dua faktor (2FA) 6 digit untuk masuk ke Estaka Dental Clinic."
          onSubmit={(e) => {
            e.preventDefault();
            void submitCode(code);
          }}
        >
          <label className="au-in block text-sm font-medium" htmlFor="code">
            Kode 6 digit
          </label>
          <input
            id="code"
            name="code"
            toolparamdescription="Kode verifikasi 6 digit dari aplikasi authenticator atau kode cadangan."
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\s/g, "");
              setCode(v);
              if (/^\d{6}$/.test(v)) void submitCode(v); // auto-submit on the sixth digit
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={11}
            className={`${inputCls} text-center font-mono text-2xl tracking-[0.4em]`}
            aria-describedby="err"
          />
          <p id="err" role="alert" className="mt-3 min-h-5 text-sm text-[var(--bad)]">
            {err}
          </p>
          <button className={`${btnCls} mt-3`} disabled={busy || code.length < 6}>
            {busy ? "Memeriksa…" : "Verifikasi"}
          </button>
          <button type="button" onClick={() => (setStep("cred"), setCode(""), setErr(""))} className="mt-4 w-full text-sm text-muted underline-offset-4 hover:underline">
            Kembali
          </button>
        </form>
      </AuthShell>
    );

  return (
    <AuthShell title="Masuk" sub="Untuk dokter, staf, apoteker, dan pasien Estaka Dental Clinic.">
      <form
        ref={card}
        toolname="login_estaka"
        tooldescription="Masuk ke portal pasien atau dashboard staf Estaka Dental Clinic dengan email dan kata sandi."
        onSubmit={submitCred}
        noValidate
      >
        <label className="au-in block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" toolparamdescription="Alamat email akun pasien atau staf Estaka Dental Clinic." value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required className={inputCls} />
        <label className="au-in mt-4 block text-sm font-medium" htmlFor="pw">
          Kata sandi
        </label>
        <input id="pw" name="password" type="password" toolparamdescription="Kata sandi akun Estaka Dental Clinic." value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={inputCls} />
        {SITE_KEY && (
          <div className="au-in mt-4 overflow-x-auto">
            <ReCAPTCHA ref={cap} sitekey={SITE_KEY} onChange={setCaptcha} onExpired={() => setCaptcha(null)} theme="dark" />
          </div>
        )}
        <p role="alert" className="mt-3 min-h-5 text-sm text-[var(--bad)]">
          {err}
        </p>
        {unverified && (
          <p className="text-sm text-muted">
            <button type="button" onClick={resend} className="text-fg underline underline-offset-4">Kirim ulang email verifikasi</button> {sentMsg}
          </p>
        )}
        <button className={`${btnCls} au-in mt-3`} disabled={busy || !email || !password}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
        {pk && (
          <button type="button" onClick={() => void passkey()} disabled={busy} className="au-in mt-3 min-h-11 w-full rounded-xl border border-line text-sm transition-transform active:scale-[0.98]">Masuk dengan sidik jari / Face ID</button>
        )}
        <div className="au-in mt-5 flex items-center justify-between text-sm text-muted">
          <Link href="/lupa-sandi" className="underline-offset-4 hover:text-fg hover:underline">
            Lupa kata sandi?
          </Link>
          <span>
            Pasien baru?{" "}
            <Link href="/daftar" className="text-fg underline underline-offset-4">
              Daftar
            </Link>
          </span>
        </div>
      </form>
    </AuthShell>
  );
}
