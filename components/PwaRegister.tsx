"use client";

import { useEffect } from "react";

/** Registers the service worker (production, or dev when explicitly enabled). Renders nothing. */
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !location.search.includes("sw=1") && !sessionStorage.getItem("sw-dev")) return;
    try { sessionStorage.setItem("sw-dev", "1"); } catch { /* storage blocked */ }
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
  }, []);
  return null;
}
