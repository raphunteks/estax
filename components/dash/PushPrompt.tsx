"use client";

import { useEffect } from "react";
import { api } from "./kit";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

/** Registers this device for push for the signed-in user. Returns true when a subscription is stored. */
async function subscribe(): Promise<boolean> {
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  const k = await api<{ key: string | null }>("/api/push/key");
  if (!k.ok || !k.key) return false;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(k.key) }));
  return (await api("/api/push/subscribe", "POST", { subscription: sub.toJSON() })).ok;
}

/**
 * Invisible. Asks for notification permission once, on the first tap/key after sign-in (browsers only
 * allow the prompt after a user gesture), and never asks again on this browser. If permission was
 * already granted, it silently re-registers the device. Also unlocks in-app sound on that same gesture.
 * Management and turning it off stay in Account > Aplikasi & notifikasi.
 */
export default function PushPrompt({ uid }: { uid: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const askedKey = `estaka:push-asked:${uid}`;
    let off = () => {};
    const run = async () => {
      try {
        if (Notification.permission === "granted") { if (!sessionStorage.getItem(`estaka:push-sync:${uid}`)) { await subscribe(); sessionStorage.setItem(`estaka:push-sync:${uid}`, "1"); } return; }
        if (Notification.permission !== "default" || get(askedKey)) return;
        const onGesture = () => {
          off();
          set(askedKey, String(Date.now()));
          try { const A = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; void new A().resume(); } catch { /* sound unlock is best effort */ }
          void Notification.requestPermission().then(async (p) => { if (p === "granted") { await subscribe(); await api("/api/push/test", "POST"); } }).catch(() => null);
        };
        window.addEventListener("pointerdown", onGesture, { once: true });
        window.addEventListener("keydown", onGesture, { once: true });
        off = () => { window.removeEventListener("pointerdown", onGesture); window.removeEventListener("keydown", onGesture); };
      } catch { /* unsupported browser: stay silent */ }
    };
    void run();
    return () => off();
  }, [uid]);
  return null;
}
