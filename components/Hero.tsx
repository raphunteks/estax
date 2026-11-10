"use client";

// Silence Three.js r183+ deprecation warning for THREE.Clock used internally by @react-three/fiber
if (typeof window !== "undefined") {
  const win = window as unknown as { __THREE_CLOCK_SILENCED__?: boolean };
  if (!win.__THREE_CLOCK_SILENCED__) {
    win.__THREE_CLOCK_SILENCED__ = true;
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("Clock: This module has been deprecated")
      ) {
        return;
      }
      origWarn.apply(console, args);
    };
  }
}

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLazyGsap } from "@/lib/use-gsap-lazy";
import { roomCapable } from "@/lib/room-capable";
import { L } from "./L";
import { hero } from "@/lib/content";

const TOOTH =
  "M300 120C250 100 190 130 190 200C190 260 210 300 220 360C228 410 245 470 270 470C290 470 285 400 300 400C315 400 310 470 330 470C355 470 372 410 380 360C390 300 410 260 410 200C410 130 350 100 300 120Z";

// The 3D clinic is a separate chunk: it is fetched only on capable devices, after the headline has painted.
const HeroRoom = dynamic(() => import("./hero3d/HeroRoom"), { ssr: false });

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const wantsRoom = useRef(false);
  const [room, setRoom] = useState(false);

  useEffect(() => {
    // Decide once on mount; a visitor who is already scrolling keeps the static hero (no late pin jump).
    if (!roomCapable() || window.scrollY > 40) return;
    if (new URLSearchParams(window.location.search).get("room") === "on") {
      wantsRoom.current = true;
      const t = setTimeout(() => setRoom(true), 0);
      return () => clearTimeout(t);
    }
    // Load the 3D WebGL scene only after real pointer interaction near the top of the page so initial load has 0ms TBT and 0 CLS.
    let done = false;
    const activate = () => {
      if (done) return;
      done = true;
      window.removeEventListener("pointermove", activate);
      window.removeEventListener("pointerdown", activate);
      if (window.scrollY > 20) return;
      wantsRoom.current = true;
      void import("./hero3d/HeroRoom").then(() => {
        if (window.scrollY <= 20) setRoom(true);
      });
    };
    window.addEventListener("pointermove", activate, { once: true, passive: true });
    window.addEventListener("pointerdown", activate, { once: true, passive: true });
    return () => {
      done = true;
      window.removeEventListener("pointermove", activate);
      window.removeEventListener("pointerdown", activate);
    };
  }, []);

  useLazyGsap(root, ({ gsap, MOTION_OK, FINE_POINTER }) => {
    // The 3D room owns the hero's scroll choreography; the static parallax only runs without it.
    if (wantsRoom.current) return;
    {
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        // Entrance runs in CSS (globals.css, .h-*), so the headline paints without waiting for GSAP. GSAP only adds scroll and pointer depth.
        // Scroll exit: content drifts up and fades, media sinks slower (parallax depth).
        gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: 0.6 } })
          .to(".h-copy", { y: -90, opacity: 0.0, ease: "none" }, 0)
          .to(".h-media-wrap", { y: 120, scale: 1.06, ease: "none" }, 0)
          .to(".h-glow", { y: 200, ease: "none" }, 0);

      });

      // Mouse parallax (desktop only). Layers move at different depths.
      mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
        const el = root.current;
        if (!el) return;
        const layers = [
          { sel: ".h-media-wrap", x: 26, y: 14 },
          { sel: ".h-glow", x: 46, y: 26 },
          { sel: ".h-copy", x: -8, y: -5 },
        ].map((l) => ({
          ...l,
          qx: gsap.quickTo(l.sel, "x", { duration: 1, ease: "power3.out" }),
          qy: gsap.quickTo(l.sel, "y", { duration: 1, ease: "power3.out" }),
        }));
        const move = (e: PointerEvent) => {
          const px = e.clientX / window.innerWidth - 0.5;
          const py = e.clientY / window.innerHeight - 0.5;
          layers.forEach((l) => {
            l.qx(px * l.x * 2);
            l.qy(py * l.y * 2);
          });
        };
        const leave = () => layers.forEach((l) => (l.qx(0), l.qy(0)));
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
    }
  });

  return (
    <section id="top" ref={root} data-room={room ? "on" : undefined} className="group relative flex min-h-dvh items-center overflow-hidden pt-[72px]">
      {room && <HeroRoom section={root} />}
      <div className="pointer-events-none absolute inset-0 -z-10 group-data-[room=on]:opacity-0" aria-hidden="true">
        <div className="h-glow glow-pulse absolute -right-32 top-1/4 size-[640px] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(1200px 600px at 20% 0%, var(--surface2), transparent 70%)" }} />
        <div className="grain absolute inset-0" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="h-copy">
          <p className="eyebrow hero-a h-eyebrow">
            <L v={hero.eyebrow} />
          </p>
          <h1 className="display display-xl h-title mt-6 text-[clamp(2.9rem,8vw,6.2rem)]">
            <L v={hero.title} />
          </h1>
          <p className="hero-a h-sub mt-7 max-w-xl text-lg leading-relaxed text-muted">
            <L v={hero.sub} />
          </p>
          <div className="hero-a h-actions mt-9 flex flex-wrap gap-3">
            <a href="/reservasi" className="btn btn-primary">
              <L v={hero.cta1} /> <span aria-hidden="true">→</span>
            </a>
            <a href="#doctors" className="btn btn-ghost">
              <L v={hero.cta2} />
            </a>
          </div>
        </div>

        <div className="h-media-wrap relative mx-auto group-data-[room=on]:invisible group-data-[room=on]:pointer-events-none aspect-square w-full min-h-[300px] max-w-[320px] sm:min-h-[400px] sm:max-w-[420px] lg:min-h-[500px] lg:max-w-[520px]" aria-hidden="true">
          <div className="hero-a h-media size-full">
            <svg viewBox="0 0 600 600" width="600" height="600" className="size-full overflow-visible">
              <defs>
                <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>
              <g className="h-orbit spin-slow" style={{ animationDuration: "90s" }}>
                <circle cx="300" cy="300" r="250" fill="none" stroke="var(--line)" strokeWidth="1" />
                <circle cx="300" cy="300" r="250" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="2 38" strokeLinecap="round" />
              </g>
              <circle className="h-orbit h-draw" pathLength="1" cx="300" cy="300" r="200" fill="none" stroke="var(--line)" strokeWidth="1" />
              <path className="h-draw" pathLength="1" d={TOOTH} fill="none" stroke="var(--accent)" strokeWidth="6" opacity="0.5" filter="url(#soft)" />
              <path className="h-draw" pathLength="1" d={TOOTH} fill="var(--card)" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
              <path className="h-draw" pathLength="1" d="M150 360Q300 520 450 360" fill="none" stroke="var(--fg)" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="float absolute left-[8%] top-[18%] size-2 rounded-full bg-accent" />
            <span className="float absolute bottom-[20%] right-[10%] size-3 rounded-full border border-accent" style={{ animationDelay: "-2s" }} />
            <span className="float absolute right-[22%] top-[10%] size-1.5 rounded-full bg-fg/50" style={{ animationDelay: "-4s" }} />
          </div>
          <span className="h-chip glass absolute -left-2 bottom-[14%] rounded-full px-4 py-2 text-xs font-semibold tracking-wide sm:left-0">
            <L v={{ id: "Dokter gigi umum", en: "General dentistry" }} />
          </span>
          <span className="h-chip glass absolute -right-2 top-[16%] rounded-full px-4 py-2 text-xs font-semibold tracking-wide sm:right-0">
            <L v={{ id: "Spesialis konservasi", en: "Conservative specialist" }} />
          </span>
        </div>
      </div>

      <div className="hero-a h-scroll absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-muted sm:flex" aria-hidden="true">
        <L v={hero.scroll} />
        <span className="scroll-line block h-10 w-px bg-accent" />
      </div>
    </section>
  );
}
