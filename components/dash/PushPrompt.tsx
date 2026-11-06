"use client";

import { useEffect, useState } from "react";
import { api } from "./kit";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export default function PushPrompt() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    if (Notification.permission === "granted") {
      void navigator.serviceWorker.getRegistration("/").then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        if (sub) setEnabled(true);
      });
    }
  }, []);

  async function activate() {
    setBusy(true);
    setMsg("");
    try {
      const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;

      const p = await Notification.requestPermission();
      if (p !== "granted") {
        setMsg("Izin notifikasi ditolak. Anda dapat mengaktifkannya di pengaturan izin browser.");
        return;
      }

      const k = await api<{ key: string | null }>("/api/push/key");
      if (!k.ok || !k.key) {
        setMsg("Gagal memuat kunci server push.");
        return;
      }

      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKey(k.key),
      }));

      const r = await api("/api/push/subscribe", "POST", { subscription: sub.toJSON() });
      if (!r.ok) {
        setMsg("Gagal mendaftarkan langganan notifikasi.");
        return;
      }

      // Send test notification to verify immediately
      await api("/api/push/test", "POST");
      setEnabled(true);
      setMsg("✓ Notifikasi berhasil aktif di perangkat ini! Kami telah mengirim notifikasi percobaan.");
    } catch (e) {
      console.error(e);
      setMsg("Gagal mengaktifkan notifikasi di perangkat ini.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported || dismissed || enabled) {
    if (enabled) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400" />
            Notifikasi push aktif di perangkat ini (Pengingat janji, antrean &amp; info promo).
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 via-accent/10 to-transparent p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🔔</span>
            <p className="font-semibold text-fg">Aktifkan Notifikasi di HP / Perangkat Anda</p>
          </div>
          <p className="text-xs text-muted sm:text-sm">
            Dapatkan pemberitahuan langsung saat antrean giliran Anda dipanggil, pengingat janji temu, dan info promo eksklusif.
          </p>
          {msg && <p className="mt-1 text-xs text-accent" role="status">{msg}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-fg"
          >
            Nanti saja
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void activate()}
            className="btn btn-primary min-h-9 px-4 py-1.5 text-xs font-semibold"
          >
            {busy ? "Mengaktifkan…" : "Izinkan Notifikasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

