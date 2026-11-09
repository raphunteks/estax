"use client";

import { useEffect } from "react";

/** In-memory (per tab) stale-while-revalidate cache. Lives for the page session; a login or logout is a hard navigation, so it never crosses users. */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export const LIVE_EVENT = "estaka:rev";

/** Last known value for a key, so a revisited tab paints instantly while fresh data loads in the background. */
export const peek = <T,>(key: string): T | null => (cache.has(key) ? (cache.get(key) as T) : null);
export const remember = (key: string, value: unknown) => void cache.set(key, value);

/** Concurrent callers of the same GET share one request (e.g. bottom bar and KPI tiles both read /api/dash/mobile). */
export function sharedGet<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = run().finally(() => setTimeout(() => inflight.delete(key), 400));
  inflight.set(key, p);
  return p;
}

/**
 * Runs `load` on mount, whenever the live-sync channel reports a data change, and as a slow safety net while the tab is visible.
 * `load` must be stable (useCallback).
 */
export function useOnLive(load: () => void, fallbackMs = 60000, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(load, 0);
    const on = () => load();
    window.addEventListener(LIVE_EVENT, on);
    const i = setInterval(() => document.visibilityState === "visible" && load(), fallbackMs);
    return () => {
      clearTimeout(t);
      clearInterval(i);
      window.removeEventListener(LIVE_EVENT, on);
    };
  }, [load, fallbackMs, enabled]);
}
