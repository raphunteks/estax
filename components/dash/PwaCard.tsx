"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./kit";

type Evt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Install-to-home-screen and push-notification switch, shared by every role. */
export default function PwaCard() {
  const [ready, setReady] = useState(false);
  const [canPush, setCanPush] = useState(false);
  const [on, setOn] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [evt, setEvt] = useState<Evt | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setCanPush(ok);
    setPerm(ok ? Notification.permission : "denied");
    if (ok) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      setOn(Boolean(await reg?.pushManager.getSubscription()) && Notification.permission === "granted");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    const env = setTimeout(() => {
      setStandalone(matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    }, 0);
    const h = (e: Event) => (e.preventDefault(), setEvt(e as Evt));
    window.addEventListener("beforeinstallprompt", h);
    const t = setTimeout(() => void refresh(), 0);
    return () => (window.removeEventListener("beforeinstallprompt", h), clearTimeout(t), clearTimeout(env));
  }, [refresh]);

  async function enable() {
    setBusy(true); setMsg("");
    try {
      const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") return setMsg("Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.");
      const k = await api<{ key: string | null }>("/api/push/key");
      if (!k.ok || !k.key) return setMsg("Notifikasi belum dikonfigurasi di server (kunci VAPID belum diisi).");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(k.key) }));
      const r = await api("/api/push/subscribe", "POST", { subscription: sub.toJSON() });
      if (!r.ok) return setMsg("Gagal menyimpan langganan.");
      await api("/api/push/test", "POST");
      setOn(true); setMsg("Notifikasi aktif di perangkat ini.");
    } catch {
      setMsg("Perangkat atau browser ini belum mendukung notifikasi.");
    } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api("/api/push/subscribe", "DELETE", { endpoint: sub.endpoint }); await sub.unsubscribe(); }
    setOn(false); setMsg("Notifikasi dimatikan di perangkat ini."); setBusy(false);
  }
  const install = async () => { if (!evt) return; await evt.prompt(); await evt.userChoice; setEvt(null); };

  return (
    <section className="glass rounded-2xl p-5 sm:p-6" aria-labelledby="pwa-h">
      <h2 id="pwa-h" className="display text-xl">Aplikasi & notifikasi</h2>
      {!ready ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-fg/5" /> : (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="font-medium">Pasang di layar utama</p>
            {standalone ? <p className="text-muted">Aplikasi sudah terpasang.</p>
              : evt ? <button className="btn btn-primary mt-2" onClick={() => void install()}>Pasang aplikasi</button>
              : ios ? <p className="text-muted">Di iPhone/iPad (Safari): ketuk tombol Bagikan, lalu pilih “Tambahkan ke Layar Utama”. Notifikasi hanya aktif setelah aplikasi dipasang.</p>
              : <p className="text-muted">Di Chrome: menu ⋮ lalu “Instal aplikasi” atau “Tambahkan ke layar utama”.</p>}
          </div>
          <div>
            <p className="font-medium">Notifikasi</p>
            {!canPush ? <p className="text-muted">{ios && !standalone ? "Pasang aplikasi ke layar utama dulu agar notifikasi bisa diaktifkan." : "Browser ini belum mendukung notifikasi push."}</p> : (
              <div className="mt-1">
                <p className="text-muted">Pemberitahuan janji, panggilan antrean, dan resep langsung ke perangkat ini.</p>
                {on ? <button className="btn btn-ghost mt-2" disabled={busy} onClick={() => void disable()}>Matikan di perangkat ini</button>
                  : <button className="btn btn-primary mt-2" disabled={busy || perm === "denied"} onClick={() => void enable()}>{busy ? "Memproses…" : "Aktifkan notifikasi"}</button>}
                {perm === "denied" && <p className="mt-2 text-[var(--bad)]">Izin diblokir di browser. Ubah lewat pengaturan situs.</p>}
              </div>
            )}
          </div>
          <p role="status" className="min-h-5 text-muted">{msg}</p>
        </div>
      )}
    </section>
  );
}
