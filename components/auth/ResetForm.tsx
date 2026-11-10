"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, btnCls, inputCls } from "./ui";

export default function ResetForm({ token }: { token: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw !== pw2) return setErr("Konfirmasi kata sandi tidak sama.");
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (d?.ok) setDone(true);
    else setErr(d?.code === "invalid_token" ? "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru." : (d?.message ?? "Gagal mengatur kata sandi."));
  }

  return (
    <AuthShell title="Atur kata sandi baru" sub="Minimal 10 karakter, kombinasi huruf dan angka.">
      {done ? (
        <div role="status" className="space-y-4 text-sm">
          <p>Kata sandi diperbarui. Semua perangkat lain telah dikeluarkan.</p>
          <Link href="/masuk" className="btn btn-primary w-full">
            Masuk
          </Link>
        </div>
      ) : (
        <form
          toolname="set_new_password"
          tooldescription="Simpan kata sandi baru untuk akun Estaka Dental Clinic."
          onSubmit={submit}
          noValidate
        >
          <label className="block text-sm font-medium" htmlFor="pw">
            Kata sandi baru
          </label>
          <input id="pw" name="password" type="password" toolparamdescription="Kata sandi baru minimal 10 karakter kombinasi huruf dan angka." value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus className={inputCls} />
          <label className="mt-4 block text-sm font-medium" htmlFor="pw2">
            Ulangi kata sandi
          </label>
          <input id="pw2" name="passwordConfirm" type="password" toolparamdescription="Ulangi kata sandi baru untuk konfirmasi." value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className={inputCls} />
          <p role="alert" className="mt-3 min-h-5 text-sm text-[var(--bad)]">
            {err}
          </p>
          <button className={`${btnCls} mt-3`} disabled={busy || !pw || !pw2}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
