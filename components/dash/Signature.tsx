"use client";

import { useEffect, useRef, useState } from "react";

/** Finger/mouse signature pad. onChange gets a PNG data URL (or "" when empty). */
export default function Signature({ onChange }: { onChange: (png: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height] as const; };
    const d = (e: PointerEvent) => { down.current = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y); ctx.stroke(); };
    const m = (e: PointerEvent) => { if (!down.current) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const u = () => { if (!down.current) return; down.current = false; setEmpty(false); onChange(c.toDataURL("image/png")); };
    c.addEventListener("pointerdown", d); c.addEventListener("pointermove", m); c.addEventListener("pointerup", u); c.addEventListener("pointercancel", u);
    return () => { c.removeEventListener("pointerdown", d); c.removeEventListener("pointermove", m); c.removeEventListener("pointerup", u); c.removeEventListener("pointercancel", u); };
  }, [onChange]);
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(""); };
  return (
    <div>
      <canvas ref={ref} width={400} height={140} aria-label="Area tanda tangan" className="h-36 w-full touch-none rounded-xl border border-line bg-white" />
      <button type="button" onClick={clear} disabled={empty} className="mt-1 text-xs text-muted underline-offset-4 hover:underline disabled:opacity-40">Hapus tanda tangan</button>
    </div>
  );
}
