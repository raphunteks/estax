"use client";

import { useRef, useState } from "react";
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

  async function submitCode(value: string) {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: value }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (!d?.ok) {
      setCode("");
      setErr(d?.code === "invalid" ? "Kode salah atau sudah dipakai." : (MESSAGES[d?.code] ?? "Terjadi kesalahan."));
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
          <p id="err" role="alert" className="mt-3 min-h-5 text-sm text-red-400">
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
      <form ref={card} onSubmit={submitCred} noValidate>
        <label className="au-in block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required className={inputCls} />
        <label className="au-in mt-4 block text-sm font-medium" htmlFor="pw">
          Kata sandi
        </label>
        <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={inputCls} />
        {SITE_KEY && (
          <div className="au-in mt-4 overflow-x-auto">
            <ReCAPTCHA ref={cap} sitekey={SITE_KEY} onChange={setCaptcha} onExpired={() => setCaptcha(null)} theme="dark" />
          </div>
        )}
        <p role="alert" className="mt-3 min-h-5 text-sm text-red-400">
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
