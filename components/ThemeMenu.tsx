"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { THEMES, THEME_KEYS, applyTheme, autoTheme, type ThemePref } from "@/lib/theme";

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pref", "data-theme"] });
  return () => mo.disconnect();
};
const pref = (): ThemePref => (document.documentElement.dataset.pref as ThemePref) || "auto";

function Swatch({ a, b }: { a: string; b: string }) {
  return (
    <span aria-hidden="true" className="relative block size-9 shrink-0 overflow-hidden rounded-full border border-line" style={{ background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)` }} />
  );
}

/** Palette picker: "Ikut Jam" (WITA schedule) plus five palettes. Keyboard: arrows, Home/End, Esc. */
const SHEET = {
  md: "fixed inset-x-4 top-[4.25rem] md:absolute md:inset-x-auto md:top-full md:mt-2 md:w-80",
  lg: "fixed inset-x-4 top-[4.25rem] lg:absolute lg:inset-x-auto lg:top-full lg:mt-2 lg:w-80",
} as const;
/** `sheet`: below this breakpoint the panel is a full-width sheet under the header (prevents off-screen overflow when the button sits mid-header). */
export default function ThemeMenu({ align = "right", up = false, sheet }: { align?: "left" | "right"; up?: boolean; sheet?: "md" | "lg" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = useSyncExternalStore(subscribe, pref, () => "auto" as ThemePref);
  const shown = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme ?? "malam", () => "malam");
  const sw = THEMES[(shown in THEMES ? shown : "malam") as keyof typeof THEMES].sw;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // "Ikut Jam" re-evaluates every minute.
  useEffect(() => {
    if (current !== "auto") return;
    const id = setInterval(() => applyTheme("auto"), 60_000);
    return () => clearInterval(id);
  }, [current]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  const pick = (p: ThemePref) => {
    applyTheme(p);
    setOpen(false);
    root.current?.querySelector<HTMLElement>("button")?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false), root.current?.querySelector<HTMLElement>("button")?.focus();
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    items[(to + items.length) % items.length]?.focus();
  };
  const options: { key: ThemePref; label: string; desc: string }[] = [
    { key: "auto", label: "Ikut Jam", desc: "Berganti sepanjang hari (WITA)" },
    ...THEME_KEYS.map((k) => ({ key: k as ThemePref, label: THEMES[k].label, desc: THEMES[k].desc })),
  ];

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Pilih tema warna"
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full border border-line bg-card/60 transition-[transform,background-color] hover:bg-card active:scale-95"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill={sw[1]} />
          <path d="M5.64 18.36A9 9 0 0 1 18.36 5.64Z" fill={sw[0]} />
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
          <circle cx="12" cy="12" r="3" fill="var(--bg)" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
        </svg>
      </button>
      <div
        role="menu"
        aria-label="Tema warna"
        hidden={!open}
        className={`material z-[70] rounded-3xl border border-line bg-bg p-2 shadow-2xl ${sheet ? `${SHEET[sheet]} ${align === "right" ? (sheet === "lg" ? "lg:right-0" : "md:right-0") : (sheet === "lg" ? "lg:left-0" : "md:left-0")}` : `absolute w-[min(88vw,20rem)] ${align === "right" ? "right-0" : "left-0"} ${up ? "bottom-full mb-2" : "top-full mt-2"}`}`}
      >
        {options.map((o) => {
          const on = current === o.key;
          const s = o.key === "auto" ? null : THEMES[o.key];
          return (
            <button
              key={o.key}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              onClick={() => pick(o.key)}
              className={`flex w-full min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-card focus-visible:bg-card ${on ? "bg-card" : ""}`}
            >
              {s ? (
                <Swatch a={s.sw[0]} b={s.sw[1]} />
              ) : (
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-xs font-semibold">24</span>
              )}
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted">{o.key === "auto" ? `${o.desc} · kini ${THEMES[autoTheme()].label}` : o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
