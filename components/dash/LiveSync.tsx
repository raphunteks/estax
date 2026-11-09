"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";
import { LIVE_EVENT } from "@/lib/live";

/**
 * One heartbeat for the whole dashboard. It reads a single revision number; when it moves, the current route's server data
 * is refreshed in place (no reload, client state kept) and subscribed widgets are told to refetch.
 * Cadence adapts: 4 s while the user is active or data is changing, 10 s when calm, 20 s when idle. Paused while the tab is hidden.
 */
export default function LiveSync() {
  const router = useRouter();
  const rev = useRef<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    last.current = Date.now();
    const touch = () => (last.current = Date.now());
    const wait = () => {
      const idle = Date.now() - last.current;
      // Cadence ramah kuota: 15 detik saat aktif (hemat 75% dibanding 4s), 30 detik saat tenang, 60 detik saat idle.
      // Catatan: Aksi lokal pengguna tetap instan (150ms) lewat event 'estaka:poke'.
      return idle < 60_000 ? 15_000 : idle < 300_000 ? 30_000 : 60_000;
    };
    const tick = async () => {
      if (dead) return;
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/rev", { cache: "no-store" });
          if (r.status === 401 || r.status === 403) return; // session ended: stop quietly, the next navigation redirects
          const j = (await r.json()) as { rev?: number };
          if (typeof j.rev === "number") {
            if (rev.current !== null && j.rev !== rev.current) {
              touch();
              startTransition(() => router.refresh());
              window.dispatchEvent(new Event(LIVE_EVENT));
            }
            rev.current = j.rev;
          }
        } catch {
          /* offline: try again next tick */
        }
      }
      if (!dead) timer = setTimeout(tick, wait());
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void tick();
      }
    };
    const poke = () => {
      clearTimeout(timer);
      timer = setTimeout(tick, 150);
    };
    timer = setTimeout(tick, 0);
    window.addEventListener("estaka:poke", poke);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    return () => {
      dead = true;
      clearTimeout(timer);
      window.removeEventListener("estaka:poke", poke);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [router]);

  return null;
}
