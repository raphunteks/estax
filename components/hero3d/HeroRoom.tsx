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

import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import ClinicRoom, { type Palette } from "./ClinicRoom";
import { L } from "../L";

/** Reads the active theme tokens and derives the room's clay palette from them. */
function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  const c = (x: string) => new THREE.Color().setStyle(x);
  const bg = c(v("--bg", "#f6f1e4"));
  const fg = c(v("--fg", "#0f1f5c"));
  const accent = c(v("--accent", "#1a3bb5"));
  const surface2 = c(v("--surface2", "#ece5d2"));
  const dark = bg.getHSL({ h: 0, s: 0, l: 0 }).l < 0.4;
  const hex = (col: THREE.Color) => `#${col.getHexString()}`;
  const mix = (a: THREE.Color, b: THREE.Color, t: number) => hex(a.clone().lerp(b, t));
  const white = new THREE.Color("#ffffff");
  return {
    dark,
    bg: hex(bg),
    fg: hex(fg),
    accent: hex(accent),
    wall: dark ? mix(bg, fg, 0.2) : mix(bg, white, 0.35),
    floor: dark ? mix(surface2, fg, 0.1) : mix(surface2, bg, 0.2),
    porcelain: dark ? mix(bg, fg, 0.45) : mix(white, bg, 0.3),
    upholstery: mix(accent, dark ? bg : white, dark ? 0.25 : 0.45),
    plant: dark ? "#4f7a63" : "#7fa98a",
    wood: dark ? "#7a5d45" : "#c9a27a",
  };
}

const P = new THREE.CatmullRomCurve3([[0, 1.6, 4.6], [0, 1.6, 1.6], [-0.9, 1.65, -0.9], [-0.4, 1.6, -4.6], [0.3, 1.55, -7.2], [0.25, 1.65, -8.5], [0.2, 1.95, -9.35]].map((p) => new THREE.Vector3(...p)));
const T = new THREE.CatmullRomCurve3([[0, 1.55, 0], [0, 1.4, -3], [0.7, 1.1, -4.6], [0, 1.1, -8.5], [0, 0.9, -10], [0.15, 1.6, -9.95], [0.2, 2.2, -9.85]].map((p) => new THREE.Vector3(...p)));

const LOOK = new THREE.Vector3();

/** Camera on rails: position and look-at both follow splines driven by scroll progress. FOV widens on portrait screens. */
function Rig({ progress }: { progress: RefObject<number> }) {
  useFrame((state) => {
    const p = progress.current ?? 0;
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / state.size.height;
    const fov = aspect < 0.8 ? 74 : aspect < 1.3 ? 62 : 50;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    // On wide screens the headline sits on the left, so the facade starts shifted right and drifts to centre as you enter.
    const shift = aspect > 1.3 ? -1.5 * (1 - Math.min(1, p / 0.22)) : 0;
    P.getPoint(p, cam.position);
    cam.position.x += shift;
    T.getPoint(p, LOOK);
    LOOK.x += shift;
    cam.lookAt(LOOK);
  });
  return null;
}

/**
 * The 3D "walk into the clinic" hero layer. Renders only when scroll changes (frameloop="demand"), so it costs
 * nothing while idle or after the visitor has scrolled past. GSAP pins the hero and maps scroll to progress.
 */
export default function HeroRoom({ section }: { section: RefObject<HTMLElement | null> }) {
  const progress = useRef(0);
  const invalidate = useRef<() => void>(() => {});
  const skipTo = useRef(0);
  const [pal, setPal] = useState<Palette>(readPalette);
  const [dpr, setDpr] = useState<[number, number]>(() => (window.innerWidth < 640 ? [1, 1.3] : [1, 1.75]));

  // Re-read colours when the visitor switches theme.
  useEffect(() => {
    const mo = new MutationObserver(() => setPal(readPalette()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => invalidate.current(), [pal]);

  useEffect(() => {
    let dead = false;
    let revert: (() => void) | undefined;
    import("@/lib/gsap").then(({ gsap, ScrollTrigger }) => {
      if (dead || !section.current) return;
      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add({ mobile: "(max-width: 639px)", tablet: "(min-width: 640px) and (max-width: 1023px)", desktop: "(min-width: 1024px)" }, (c) => {
          const k = c.conditions?.mobile ? 1.8 : c.conditions?.tablet ? 2.2 : 2.8;
          const state = { p: progress.current };
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: () => `+=${Math.round(window.innerHeight * k)}`,
              pin: true,
              scrub: 0.8,
              refreshPriority: 1,
              invalidateOnRefresh: true,
              onRefresh: (st) => (skipTo.current = st.end + 2),
            },
          });
          tl.to(state, {
            p: 1,
            duration: 1,
            onUpdate: () => {
              progress.current = state.p;
              section.current?.setAttribute("data-room-progress", state.p.toFixed(2));
              invalidate.current();
            },
          }, 0)
            .to(".h-copy", { autoAlpha: 0, y: -40, duration: 0.16 }, 0.02)
            .to(".h-scroll", { autoAlpha: 0, duration: 0.06 }, 0)
            .fromTo(".room-chip-1", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.26)
            .to(".room-chip-1", { autoAlpha: 0, y: -12, duration: 0.06 }, 0.46)
            .fromTo(".room-chip-2", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.58)
            .to(".room-chip-2", { autoAlpha: 0, y: -12, duration: 0.06 }, 0.8)
            .fromTo(".room-white", { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.9);
          ScrollTrigger.sort();
        });
      }, section.current);
      revert = () => ctx.revert();
    });
    return () => {
      dead = true;
      revert?.();
    };
  }, [section]);

  const skip = () => window.scrollTo({ top: skipTo.current, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <>
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <Canvas
          className="room-canvas"
          dpr={dpr}
          frameloop="demand"
          flat
          camera={{ position: [0, 1.6, 4.6], fov: 50, near: 0.1, far: 40 }}
          gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
          onCreated={(s) => (invalidate.current = s.invalidate)}
        >
          <color attach="background" args={[pal.bg]} />
          <fog attach="fog" args={[pal.bg, 8, 21]} />
          <PerformanceMonitor onDecline={() => setDpr([1, 1])} />
          <Rig progress={progress} />
          <ClinicRoom pal={pal} progress={progress} />
        </Canvas>
        {/* Legibility scrim behind the headline: top on phones, left on desktop. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--bg)_0%,color-mix(in_oklab,var(--bg)_70%,transparent)_38%,transparent_62%)] lg:bg-[linear-gradient(90deg,var(--bg)_0%,color-mix(in_oklab,var(--bg)_75%,transparent)_34%,transparent_60%)]" />
        <div className="room-white absolute inset-0 bg-bg opacity-0" />
      </div>

      <p className="room-chip-1 glass invisible absolute bottom-28 left-4 z-10 rounded-full px-4 py-2 text-sm font-semibold sm:left-6 lg:bottom-24 lg:left-auto lg:right-8">
        <L v={{ id: "Reservasi online 24 jam", en: "Book online, 24/7" }} />
      </p>
      <p className="room-chip-2 glass invisible absolute bottom-28 left-4 z-10 rounded-full px-4 py-2 text-sm font-semibold sm:left-6 lg:bottom-24 lg:left-auto lg:right-8">
        <L v={{ id: "Rekam medis digital & odontogram", en: "Digital records & odontogram" }} />
      </p>

      <div className="absolute inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 sm:inset-x-6 lg:justify-end">
        <a href="/reservasi" className="btn btn-primary lg:hidden">
          <L v={{ id: "Buat janji", en: "Book now" }} /> <span aria-hidden="true">→</span>
        </a>
        <button type="button" onClick={skip} className="glass rounded-full px-4 py-2.5 text-sm font-medium transition-transform active:scale-95">
          <L v={{ id: "Lewati", en: "Skip" }} /> <span aria-hidden="true">↓</span>
        </button>
      </div>
    </>
  );
}
