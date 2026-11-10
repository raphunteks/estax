"use client";

import ThemeMenu from "@/components/ThemeMenu";
import { useEffect, useState } from "react";
import { L } from "./L";
import { clinic, nav, hero, navCopy } from "@/lib/content";
import { setLang, useLang } from "@/lib/lang";
import { registerWebMcp } from "@/lib/webmcp";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lang = useLang();
  // Links use each section's own URL; on the home page a click scrolls to the section (see Global).
  const ROUTE: Record<string, string> = { "#doctors": "/dokter", "#specialties": "/layanan", "#technology": "/teknologi", "#pricing": "/biaya", "#faq": "/faq", "#location": "/lokasi" };
  const to = (h: string) => ROUTE[h] ?? h;

  useEffect(() => registerWebMcp(), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);


  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${
        scrolled ? "material border-line" : "border-transparent"
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain link on purpose: Global scrolls to top on the home page */}
        <a href="/" className="display text-2xl" aria-label={clinic.name}>
          Estaka<span className="text-accent">.</span>
        </a>

        <ul className="hidden items-center gap-7 text-sm text-muted lg:flex">
          {nav.map((n) => (
            <li key={n.href}>
              <a href={to(n.href)} className="transition-colors hover:text-fg">
                <L v={n.label} />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line p-0.5 text-xs font-semibold" role="group" aria-label={lang === "en" ? navCopy.langAria.en : navCopy.langAria.id}>
            {(["id", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`min-h-9 min-w-9 rounded-full px-2 uppercase transition-colors ${lang === l ? "bg-accent text-accent-ink" : "text-muted hover:text-fg"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <ThemeMenu />
          <a href="/masuk" className="btn btn-ghost hidden sm:inline-flex">
            <L v={navCopy.login} />
          </a>
          <a href="/reservasi" className="btn btn-primary hidden sm:inline-flex">
            <L v={hero.cta1} />
          </a>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-line lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? (lang === "en" ? navCopy.menuClose.en : navCopy.menuClose.id) : (lang === "en" ? navCopy.menuOpen.en : navCopy.menuOpen.id)}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        data-open={open}
        inert={!open}
        className="menu-panel material absolute right-3 top-[64px] w-[min(92vw,22rem)] rounded-3xl border border-line p-5 shadow-2xl lg:hidden"
      >
        <ul className="flex flex-col">
          {nav.map((n) => (
            <li key={n.href}>
              <a href={to(n.href)} onClick={() => setOpen(false)} className="press block border-b border-line py-3.5 text-lg">
                <L v={n.label} />
              </a>
            </li>
          ))}
        </ul>
        <a href="/masuk" className="btn btn-ghost mt-5 w-full">
          <L v={navCopy.login} />
        </a>
        <a href="/reservasi" onClick={() => setOpen(false)} className="btn btn-primary mt-3 w-full">
          <L v={hero.cta1} />
        </a>
      </div>
    </header>
  );
}
