"use client";

import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useCallback, useEffect, useState } from "react";
import { Card, ConfirmBtn, api, fmtDate } from "./kit";

type K = { id: string; name: string; createdAt: number };
/** Fingerprint / Face ID / screen-lock login (WebAuthn passkey). Needs HTTPS or localhost. */
export default function Passkey() {
  const [keys, setKeys] = useState<K[]>([]);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => void api<{ keys: K[] }>("/api/passkey").then((r) => r.ok && setKeys(r.keys)), []);
  useEffect(() => { const t = setTimeout(() => { setOk(browserSupportsWebAuthn()); load(); }, 0); return () => clearTimeout(t); }, [load]);
  const add = async () => {
    setBusy(true); setMsg("");
    try {
      const o = await api<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>("/api/passkey/register/options", "POST");
      if (!o.ok) return setMsg(o.message ?? "Gagal memulai.");
      const response = await startRegistration({ optionsJSON: o.options });
      const v = await api("/api/passkey/register/verify", "POST", { response, name: /iphone|ipad/i.test(navigator.userAgent) ? "iPhone / iPad" : /android/i.test(navigator.userAgent) ? "Android" : "Komputer ini" });
      setMsg(v.ok ? "Passkey ditambahkan." : v.message ?? "Gagal.");
      load();
    } catch { setMsg("Dibatalkan atau perangkat tidak mendukung."); } finally { setBusy(false); }
  };
  return (
    <Card title="Login sidik jari / Face ID (passkey)">
      <p className="text-sm text-muted">Masuk tanpa mengetik sandi. Akun staf dengan 2FA tetap memakai sandi dan kode 2FA.</p>
      {!ok ? <p className="mt-3 text-sm text-muted">Perangkat atau peramban ini belum mendukung passkey.</p> : (
        <>
          <ul className="mt-3 divide-y divide-line">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{k.name} <span className="text-xs text-muted">· {fmtDate(new Date(k.createdAt + 8 * 3600e3).toISOString().slice(0, 10))}</span></span>
                <ConfirmBtn label="Hapus" danger onConfirm={() => void api(`/api/passkey?id=${encodeURIComponent(k.id)}`, "DELETE").then(load)} /></li>
            ))}
          </ul>
          <button className="btn btn-primary mt-3 min-h-11" disabled={busy || keys.length >= 5} onClick={() => void add()}>{busy ? "Menunggu perangkat…" : "Tambah passkey"}</button>
        </>
      )}
      <p role="status" className="mt-2 text-sm text-muted">{msg}</p>
    </Card>
  );
}
