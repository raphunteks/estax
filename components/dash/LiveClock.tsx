"use client";

import { useEffect, useState } from "react";

/** "Jumat, 6 November 2026, 23.15 WITA" in the viewer's own time zone. Pure client timer: no network, ticks once per minute, paused while the tab is hidden. */
function stamp(): string {
  const d = new Date();
  const date = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".");
  const zone = new Intl.DateTimeFormat("id-ID", { timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${date}, ${time} ${zone}`.trim();
}

export default function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(stamp());
      if (document.visibilityState === "visible") t = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    const onVis = () => { clearTimeout(t); tick(); };
    t = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return <time suppressHydrationWarning className={`block min-h-5 ${className}`}>{now}</time>;
}
