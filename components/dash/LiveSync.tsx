"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";
import { LIVE_EVENT } from "@/lib/live";
import Pusher from "pusher-js";

/**
 * True Realtime Push Engine for Estaka:
 * 1. Primary: Pusher WebSocket channel (if NEXT_PUBLIC_PUSHER_KEY is present in env).
 * 2. Native Push: Server-Sent Events (SSE) via /api/realtime (zero third-party config).
 * 3. Local Mutation: Instant 150ms sync via 'estaka:poke'.
 *
 * ZERO active HTTP polling requests while connected to Pusher or SSE!
 */
export default function LiveSync() {
  const router = useRouter();
  const rev = useRef<number | null>(null);

  useEffect(() => {
    let dead = false;
    let es: EventSource | null = null;
    let pusher: Pusher | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const onRevChange = (newRev: number) => {
      if (typeof newRev === "number") {
        if (rev.current !== null && newRev !== rev.current) {
          startTransition(() => router.refresh());
          window.dispatchEvent(new Event(LIVE_EVENT));
        }
        rev.current = newRev;
      }
    };

    // Manual poke on local mutation (e.g. user just saved an appointment or examination)
    const poke = async () => {
      try {
        const r = await fetch("/api/rev", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { rev?: number };
          if (typeof j.rev === "number") onRevChange(j.rev);
        }
      } catch {
        /* offline */
      }
    };

    // 1. Try Pusher if configured
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (pusherKey) {
      try {
        pusher = new Pusher(pusherKey, { cluster: pusherCluster });
        const channel = pusher.subscribe("estaka-live");
        channel.bind("rev", (data: { rev: number }) => {
          if (!dead && data?.rev) onRevChange(data.rev);
        });
      } catch (err) {
        console.error("[realtime] Pusher init error, falling back to SSE:", err);
      }
    }

    // 2. Native Server-Sent Events (SSE) Push if Pusher is not configured
    const setupSse = () => {
      if (pusher || dead || typeof window === "undefined" || !window.EventSource) return;
      if (document.visibilityState !== "visible") return;

      try {
        es = new EventSource("/api/realtime");

        es.addEventListener("init", (e) => {
          try {
            const data = JSON.parse(e.data) as { rev?: number };
            if (typeof data.rev === "number") rev.current = data.rev;
          } catch {
            /* ignore */
          }
        });

        es.addEventListener("rev", (e) => {
          try {
            const data = JSON.parse(e.data) as { rev?: number };
            if (typeof data.rev === "number") onRevChange(data.rev);
          } catch {
            /* ignore */
          }
        });

        es.onerror = () => {
          // If SSE encounters an error (e.g. network blip or auth expired), close and schedule safe reconnect
          if (es) {
            es.close();
            es = null;
          }
          if (!dead) {
            clearTimeout(fallbackTimer);
            fallbackTimer = setTimeout(setupSse, 10_000);
          }
        };
      } catch {
        // SSE not supported or blocked
      }
    };

    if (!pusher) {
      setupSse();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void poke(); // Catch up on any changes missed while tab was hidden
        if (!pusher && !es) setupSse();
      } else {
        if (es) {
          es.close();
          es = null;
        }
      }
    };

    window.addEventListener("estaka:poke", poke);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      dead = true;
      if (es) {
        es.close();
        es = null;
      }
      if (pusher) {
        pusher.unsubscribe("estaka-live");
        pusher.disconnect();
        pusher = null;
      }
      clearTimeout(fallbackTimer);
      window.removeEventListener("estaka:poke", poke);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
