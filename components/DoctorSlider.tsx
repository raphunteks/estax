"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FINE_POINTER, MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/lib/gsap";
import Image from "next/image";
import { L } from "./L";
import { doctors, doctorsCopy as c } from "@/lib/content";
import { waLink } from "@/lib/wa";
import { useLang } from "@/lib/lang";

const N = doctors.length;
const doctorsLabel = "Dokter / Doctors";
const clampIdx = (v: number) => Math.max(0, Math.min(N - 1, v));
/** Soft boundary: the further past the edge, the less the content follows (units are slides). */
const rubber = (over: number, k = 0.55) => (over * k) / (1 + k * Math.abs(over));

type Api = { go: (i: number) => void; step: (d: number) => void; scrub: (p: number) => void };

export default function DoctorSlider() {
  const root = useRef<HTMLElement>(null);
  const lang = useLang();
  const stage = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(0);
  const pinRef = useRef<ScrollTrigger | null>(null); // set while the section is pinned (desktop): scroll drives the slider
  const wantedRef = useRef(0); // newest requested doctor; a pending swap must never be killed by an older fade-in

  const [active, setActive] = useState(0); // follows the slider position (drives a11y + counter)
  const [shown, setShown] = useState(0); // info panel content, swapped between fade-out and fade-in
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: MOTION_OK, reduce: "(prefers-reduced-motion: reduce)" }, (ctx) => {
        const reduce = Boolean(ctx.conditions?.reduce);
        const el = stage.current;
        if (!el) return;
        const slides = gsap.utils.toArray<HTMLElement>(".cs-slide", el);
        // Centre the slides with GSAP itself (not a CSS translate that GSAP would have to parse at an arbitrary moment).
        gsap.set(slides, { xPercent: -50 });
        const state = { pos: 0 };
        let spacing = 280;

        const measure = () => {
          const w = slides[0]?.offsetWidth ?? 280;
          spacing = w * (window.innerWidth < 640 ? 0.62 : 0.9);
        };

        const fadeIn = () => {
          gsap.fromTo(".cs-swap", { y: reduce ? 0 : 8, opacity: 0 }, { y: 0, opacity: 1, duration: reduce ? 0.2 : 0.42, stagger: reduce ? 0 : 0.06, ease: "power3.out", overwrite: true });
        };
        const swapInfo = (i: number) => {
          wantedRef.current = i;
          gsap.to(".cs-swap", {
            y: reduce ? 0 : -8,
            opacity: 0,
            duration: reduce ? 0.12 : 0.18,
            ease: "power2.in",
            overwrite: true,
            onComplete: () => {
              // Latest request wins. If the user came back to the same doctor, just fade back in.
              if (wantedRef.current !== shownRef.current) setShown(wantedRef.current);
              else fadeIn();
            },
          });
        };

        let current = 0;
        const render = () => {
          const pos = state.pos;
          slides.forEach((s, i) => {
            const off = i - pos;
            const a = Math.min(Math.abs(off), 2);
            if (reduce) {
              gsap.set(s, { x: 0, scale: 1, rotationY: 0, opacity: Math.max(0, 1 - Math.min(Math.abs(off), 1)), zIndex: 10 - Math.round(a) });
            } else {
              gsap.set(s, {
                x: off * spacing,
                scale: 1 - Math.min(a, 1.4) * 0.2,
                rotationY: gsap.utils.clamp(-40, 40, -off * 16),
                opacity: Math.max(0.12, 1 - a * 0.62),
                zIndex: 10 - Math.round(a * 2),
              });
            }
          });
          gsap.set(".cs-ghost", { xPercent: -pos * 12 });
          const idx = clampIdx(Math.round(pos));
          if (idx !== current) {
            current = idx;
            setActive(idx);
            swapInfo(idx);
          }
        };

        const settle = (i: number, velocity = 0) => {
          const st = pinRef.current;
          if (st) {
            // Pinned: the page scroll is the source of truth. Move the scroll; the trigger updates the slider.
            gsap.killTweensOf(state);
            window.scrollTo({ top: st.start + (i / (N - 1)) * (st.end - st.start), behavior: reduce ? "auto" : "smooth" });
            return;
          }
          gsap.killTweensOf(state);
          if (reduce) {
            gsap.to(state, { pos: i, duration: 0.2, ease: "power1.out", onUpdate: render });
            return;
          }
          if (Math.abs(velocity) > 0.05) {
            // Velocity handoff: inertia continues at release speed, then snaps to a slide.
            gsap.to(state, {
              inertia: { pos: { velocity, min: 0, max: N - 1, end: gsap.utils.snap(1) }, resistance: 520 },
              onUpdate: render,
            });
          } else {
            gsap.to(state, { pos: i, duration: 0.9, ease: "power3.out", onUpdate: render });
          }
        };

        api.current = {
          go: (i) => settle(clampIdx(i)),
          step: (d) => settle(clampIdx(Math.round(state.pos) + d)),
          scrub: (p) => {
            gsap.to(state, { pos: p, duration: 0.45, ease: "power3.out", overwrite: true, onUpdate: render });
          },
        };

        measure();
        render();
        const ro = new ResizeObserver(() => {
          measure();
          render();
        });
        ro.observe(el);

        // ---- Drag: respond immediately, track 1:1 after 10px hysteresis, hand velocity to inertia. ----
        let down = false;
        let dragging = false;
        let startX = 0;
        let startPos = 0;
        let hist: { x: number; t: number }[] = [];
        let pid = -1;

        const onDown = (e: PointerEvent) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          down = true;
          dragging = false;
          startX = e.clientX;
          startPos = state.pos; // interrupt: continue from the live value, never the target
          hist = [{ x: e.clientX, t: e.timeStamp }];
          pid = e.pointerId;
          gsap.killTweensOf(state);
        };
        const onMove = (e: PointerEvent) => {
          if (!down || e.pointerId !== pid) return;
          if (!dragging) {
            if (Math.abs(e.clientX - startX) < 10) return;
            dragging = true;
            el.setPointerCapture(pid);
            el.dataset.drag = "true";
            startX = e.clientX;
            startPos = state.pos;
          }
          const raw = startPos - (e.clientX - startX) / spacing;
          state.pos = raw < 0 ? -rubber(-raw) : raw > N - 1 ? N - 1 + rubber(raw - (N - 1)) : raw;
          hist.push({ x: e.clientX, t: e.timeStamp });
          while (hist.length > 2 && e.timeStamp - hist[0].t > 100) hist.shift();
          render();
        };
        const onUp = (e: PointerEvent) => {
          if (!down || e.pointerId !== pid) return;
          down = false;
          delete el.dataset.drag;
          if (!dragging) return;
          el.dataset.moved = "true";
          window.setTimeout(() => delete el.dataset.moved, 0);
          const a = hist[0];
          const b = hist[hist.length - 1];
          const stale = e.timeStamp - b.t > 80;
          const vPx = !stale && b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
          const v = gsap.utils.clamp(-7, 7, -vPx / spacing);
          settle(clampIdx(Math.round(state.pos)), v);
        };
        // Trackpad / shift+wheel horizontal scroll moves one doctor per gesture.
        let wheelLock = 0;
        const onWheel = (e: WheelEvent) => {
          const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
          if (Math.abs(dx) < 8) return;
          e.preventDefault();
          if (e.timeStamp - wheelLock < 450) return;
          wheelLock = e.timeStamp;
          api.current?.step(dx > 0 ? 1 : -1);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("pointerdown", onDown);
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onUp);

        // ---- Entrance + parallax (motion only) ----
        const cleanups: Array<() => void> = [];
        if (!reduce) {
          const tl = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
          });
          tl.fromTo(".cs-bg", { scale: 1.08 }, { scale: 1, duration: 1.2 }, 0)
            .fromTo(".cs-heading", { y: -16 }, { y: 0, duration: 0.8 }, 0.05)
            .fromTo(".cs-portrait", { y: 40 }, { y: 0, duration: 0.85, stagger: 0.07 }, 0.1)
            .fromTo(".cs-ring", { scale: 0.85 }, { scale: 1, duration: 1.2 }, 0.15)
            .fromTo(".cs-info", { x: -24 }, { x: 0, duration: 0.8 }, 0.2)
            .fromTo(".cs-hud", { x: 24 }, { x: 0, duration: 0.8 }, 0.25)
            .fromTo(".cs-bar", { y: 16 }, { y: 0, duration: 0.8 }, 0.3)
            .fromTo(".cs-ground", { scaleX: 0 }, { scaleX: 1, duration: 1.1 }, 0.15)
            .set([".cs-info", ".cs-hud"], { clearProps: "transform" });

          // Light parallax drift of the whole section while it crosses the viewport.
          gsap.to(".cs-ghost-wrap", { y: -80, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.8 } });
        }

        return () => {
          ro.disconnect();
          el.removeEventListener("wheel", onWheel);
          el.removeEventListener("pointerdown", onDown);
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
          cleanups.forEach((fn) => fn());
          gsap.killTweensOf(state);
          api.current = null;
        };
      });

      // Desktop and mobile: pin the section and let the scroll walk through the doctors (down = next, up = back to the first).
      mm.add("(prefers-reduced-motion: no-preference) and (min-height: 620px)", () => {
        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top top",
          end: () => `+=${(N - 1) * 85}%`,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: { snapTo: 1 / (N - 1), duration: { min: 0.2, max: 0.6 }, delay: 0.08, ease: "power2.inOut" },
          onUpdate: (self) => api.current?.scrub(self.progress * (N - 1)),
        });
        pinRef.current = st;
        return () => {
          pinRef.current = null;
          st.kill();
        };
      });

      mm.add(`(prefers-reduced-motion: no-preference) and ${FINE_POINTER}`, () => {
      const sec = root.current;
      if (!sec) return;
      const sx = gsap.quickTo(".cs-layer", "x", { duration: 0.9, ease: "power3.out" });
      const sy = gsap.quickTo(".cs-layer", "y", { duration: 0.9, ease: "power3.out" });
      const bx = gsap.quickTo(".cs-bg", "x", { duration: 1.2, ease: "power3.out" });
      const by = gsap.quickTo(".cs-bg", "y", { duration: 1.2, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = sec.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        sx(-px * 26);
        sy(-py * 14);
        bx(px * 46);
        by(py * 26);
      };
      const leave = () => {
        sx(0);
        sy(0);
        bx(0);
        by(0);
      };
      sec.addEventListener("pointermove", move);
      sec.addEventListener("pointerleave", leave);
      return () => {
        sec.removeEventListener("pointermove", move);
        sec.removeEventListener("pointerleave", leave);
      };
    });
    },
    { scope: root },
  );

  // Fade the new info in after React has swapped it (skip the initial mount).
  const first = useRef(true);
  useEffect(() => {
    shownRef.current = shown;
    if (first.current) {
      first.current = false;
      return;
    }
    if (wantedRef.current !== shown) return; // a newer swap is already fading out; let it finish
    gsap.fromTo(".cs-swap", { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: "power3.out", overwrite: true });
  }, [shown]);

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowRight: () => api.current?.step(1),
      ArrowDown: () => api.current?.step(1),
      ArrowLeft: () => api.current?.step(-1),
      ArrowUp: () => api.current?.step(-1),
      Home: () => api.current?.go(0),
      End: () => api.current?.go(N - 1),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  // ---- Profile (story) panel: slides in from the left, returns the same way. ----
  const animIn = (reduce: boolean) => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel || !scrim) return;

    const img = imgRef.current;
    const items = panel.querySelectorAll(".cs-panel-item");
    const targets: (Element | Node)[] = [panel, scrim];
    if (img) targets.push(img);
    if (items.length) targets.push(...Array.from(items));
    gsap.killTweensOf(targets);

    if (reduce) {
      gsap.fromTo(panel, { opacity: 0, xPercent: 0 }, { opacity: 1, duration: 0.2 });
      gsap.to(scrim, { opacity: 1, duration: 0.2 });
    } else {
      gsap.fromTo(panel, { xPercent: -100, opacity: 1, x: 0 }, { xPercent: 0, duration: 0.55, ease: "power3.out" });
      gsap.to(scrim, { opacity: 1, duration: 0.4 });
      if (img) gsap.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 1.1, ease: "power3.out" });
      if (items.length) gsap.fromTo(items, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, delay: 0.2, ease: "power3.out" });
    }
  };

  const animOut = (reduce: boolean, done: () => void) => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel || !scrim) {
      done();
      return;
    }
    gsap.killTweensOf([panel, scrim]);
    gsap.to(scrim, { opacity: 0, duration: 0.3 });
    gsap.to(panel, {
      ...(reduce ? { opacity: 0 } : { xPercent: -100 }),
      duration: reduce ? 0.2 : 0.45,
      ease: "power3.inOut",
      onComplete: done,
    });
  };

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const openProfile = (trigger: HTMLElement) => {
    opener.current = trigger;
    setOpen(true);
    requestAnimationFrame(() => {
      animIn(reduced());
      window.setTimeout(() => closeBtn.current?.focus(), 60);
    });
  };
  const closeProfile = () =>
    animOut(reduced(), () => {
      setOpen(false);
      opener.current?.focus();
    });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && closeProfile();
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const d = doctors[shown];
  const wa = waLink(`Halo Estaka Dental Clinic, saya ingin membuat janji dengan ${d.name}.`);

  return (
    <section ref={root} id="doctors" className="relative overflow-hidden py-14 sm:py-16 mpin:flex mpin:h-svh mpin:flex-col mpin:py-0 mpin:pt-20 lg:flex lg:h-svh lg:min-h-[600px] lg:flex-col lg:py-0 lg:pt-24" aria-labelledby="doctors-h">
      {/* Background: aura + giant index numeral */}
      <div className="cs-bg pointer-events-none absolute inset-0 -z-10 cs-a" aria-hidden="true">
        <div className="absolute left-1/2 top-[42%] size-[min(90vw,900px)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, var(--glow), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--bg), transparent 18%, transparent 82%, var(--bg))" }} />
      </div>
      <div className="cs-ghost-wrap pointer-events-none absolute inset-x-0 top-[14%] -z-10 select-none" aria-hidden="true">
        <div className="cs-ghost display whitespace-nowrap text-center text-[clamp(10rem,32vw,30rem)] leading-none text-fg/[0.04]">
          {doctors.map((_, i) => `0${i + 1}`).join("  ")}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="cs-heading cs-a max-w-xl">
          <p className="eyebrow">
            <L v={c.eyebrow} />
          </p>
          <h2 id="doctors-h" className="display mt-3 text-[clamp(2rem,4.4vw,3.4rem)] lg:mt-2 lg:text-[clamp(2rem,3.4vw,3rem)]">
            <L v={c.title} />
          </h2>
        </div>
      </div>

      <div className="relative mt-6 mpin:mt-1 mpin:flex mpin:min-h-0 mpin:flex-1 mpin:flex-col lg:mt-2 lg:block lg:min-h-0 lg:flex-1">
        {/* Stage */}
        <div
          ref={stage}
          role="group"
          aria-roledescription="carousel"
          aria-label={doctorsLabel}
          onKeyDown={onKey}
          className="cs-stage relative mx-auto h-[clamp(360px,54vh,540px)] mpin:h-auto mpin:min-h-0 mpin:flex-1 lg:h-full w-full touch-pan-y select-none overflow-visible data-[drag=true]:cursor-grabbing lg:cursor-grab"
          style={{ perspective: "1400px" }}
        >
          <div className="cs-layer absolute inset-0">
            <svg className="cs-ring cs-a absolute left-1/2 top-[48%] size-[min(78vw,560px)] -translate-x-1/2 -translate-y-1/2 text-accent/50" viewBox="0 0 100 100" fill="none" aria-hidden="true">
              <g className="spin-slow" style={{ animationDuration: "120s" }}>
                <circle cx="50" cy="50" r="49" stroke="currentColor" strokeWidth="0.25" strokeDasharray="0.6 2.4" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" stroke="var(--line)" strokeWidth="0.3" />
              </g>
            </svg>
            <div className="cs-ground cs-a absolute bottom-[6%] left-1/2 h-4 w-[min(70vw,520px)] -translate-x-1/2 rounded-[50%] blur-md" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 45%, transparent), transparent)" }} aria-hidden="true" />

            {doctors.map((doc, i) => (
              <div key={doc.id} className="cs-slide absolute bottom-0 left-1/2 w-[clamp(200px,min(34vw,46vh),400px)] mpin:w-[clamp(150px,min(56vw,calc((100svh-430px)*0.75)),340px)] lg:w-[clamp(180px,min(30vw,calc((100svh-330px)*0.75)),400px)] will-change-transform [transform-style:preserve-3d]">
                <div className="cs-portrait cs-a">
                  <button
                    type="button"
                    aria-label={`${doc.name}`}
                    aria-current={active === i}
                    tabIndex={active === i ? 0 : -1}
                    data-cursor
                    onClick={(e) => {
                      if (stage.current?.dataset.moved) return;
                      if (active === i) openProfile(e.currentTarget);
                      else api.current?.go(i);
                    }}
                    className="block w-full rounded-3xl outline-offset-4"
                  >
                    <Image
                      src={doc.photo ?? ""}
                      alt={`${doc.name}, ${doc.role.id}`}
                      width={1080}
                      height={1440}
                      sizes="(min-width:1024px) 380px, 56vw"
                      priority={i === 0}
                      loading={i === 0 ? "eager" : "lazy"}
                      draggable={false}
                      className="pointer-events-none h-auto w-full [filter:drop-shadow(0_30px_40px_rgb(0_0_0/0.35))]"
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info panel (left) */}
        <div className="cs-info cs-a relative z-20 mx-auto mt-2 w-full max-w-6xl px-4 sm:px-6 mpin:mt-1 mpin:shrink-0 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:inset-y-0 lg:mt-0">
          <div className="glass pointer-events-auto rounded-3xl p-6 mpin:p-4 lg:absolute lg:left-6 lg:top-1/2 lg:max-h-full lg:w-[300px] lg:-translate-y-1/2 lg:overflow-y-auto xl:w-[330px] [@media(min-width:1024px)_and_(max-height:760px)]:p-4" style={{ backdropFilter: "blur(24px) saturate(160%)" }}>
            <p className="cs-swap eyebrow">
              <L v={d.role} />
            </p>
            <h3 className="cs-swap display mt-3 text-3xl leading-[1.05] mpin:mt-1.5 mpin:text-2xl">{d.name}</h3>
            <p className="cs-swap mt-3 text-sm leading-relaxed text-muted mpin:hidden">
              <L v={d.bio} />
            </p>
            <p className="cs-swap mt-5 text-[0.68rem] uppercase tracking-[0.2em] text-muted mpin:hidden">
              <L v={c.focusLabel} />
            </p>
            <ul className="mt-2 space-y-1.5 text-sm mpin:hidden">
              {d.focus.map((f, i) => (
                <li key={i} className="cs-swap flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                  <L v={f} />
                </li>
              ))}
            </ul>
            <button type="button" onClick={(e) => openProfile(e.currentTarget)} className="cs-swap btn btn-ghost mt-6 w-full mpin:mt-3">
              <L v={c.profile} />
            </button>
          </div>

          {/* HUD (right) */}
          <div className="cs-hud pointer-events-auto mt-4 hidden items-end gap-3 lg:absolute lg:inset-y-0 lg:right-6 lg:my-auto lg:flex lg:h-fit lg:flex-col" aria-hidden="true">
            <p className="display text-6xl leading-none text-fg">
              0{active + 1}
              <span className="text-2xl text-muted"> / 0{N}</span>
            </p>
            <div className="flex flex-col gap-2">
              {doctors.map((doc, i) => (
                <span key={doc.id} className={`block h-px origin-right bg-accent transition-[width,opacity] duration-500 ${active === i ? "w-14 opacity-100" : "w-6 opacity-40"}`} />
              ))}
            </div>
          </div>
        </div>

      </div>

      <div>
        {/* Bottom bar */}
        <div className="cs-bar cs-a mx-auto mt-6 mpin:mt-3 mpin:pb-4 flex w-full max-w-6xl lg:pb-5 flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button type="button" className="press grid size-12 place-items-center rounded-full border border-line hover:border-accent disabled:opacity-35" onClick={() => api.current?.step(-1)} disabled={active === 0} aria-label={lang === "en" ? c.prev.en : c.prev.id}>
              <span aria-hidden="true">←</span>
            </button>
            <div className="flex items-center gap-1 px-1" role="group" aria-label={lang === "en" ? c.select.en : c.select.id}>
              {doctors.map((doc, i) => (
                <button key={doc.id} type="button" aria-current={active === i ? "true" : undefined} aria-label={doc.name} onClick={() => api.current?.go(i)} className="grid min-h-11 min-w-9 place-items-center px-1">
                  <span className={`block rounded-full transition-all duration-500 ${active === i ? "h-2 w-8 bg-accent" : "size-2 bg-fg/35"}`} />
                </button>
              ))}
            </div>
            <button type="button" className="press grid size-12 place-items-center rounded-full border border-line hover:border-accent disabled:opacity-35" onClick={() => api.current?.step(1)} disabled={active === N - 1} aria-label={lang === "en" ? c.next.en : c.next.id}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <p className="hidden text-xs text-muted sm:block">
            <L v={c.hint} />
          </p>
          <a href={`/reservasi?dokter=${encodeURIComponent(doctors[active].name.replace(/^drg\.\s*/i, ""))}`} className="btn btn-primary">
            <L v={c.book} />
          </a>
        </div>
      </div>

      {/* Profile panel portalled to body to prevent stacking context traps and header overlap */}
      {mounted &&
        createPortal(
          <>
            <div
              ref={scrimRef}
              className="cs-scrim fixed inset-0 z-[70] bg-black/60 opacity-0 transition-opacity"
              style={{ pointerEvents: open ? "auto" : "none" }}
              onClick={closeProfile}
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={d.name}
              inert={!open}
              className="cs-panel material fixed inset-y-0 left-0 z-[75] grid w-full max-w-2xl grid-rows-[minmax(0,40%)_1fr] overflow-y-auto border-r border-line sm:grid-cols-2 sm:grid-rows-1 shadow-2xl"
              style={{
                visibility: open ? "visible" : "hidden",
                background: "color-mix(in srgb, var(--surface) 95%, transparent)",
                backdropFilter: "blur(32px) saturate(180%)",
              }}
            >
              {/* Floating Close Button: always top-right of panel, z-30, never covered by header */}
              <button
                ref={closeBtn}
                type="button"
                onClick={closeProfile}
                className="cs-panel-item press absolute right-4 top-4 sm:right-6 sm:top-6 z-30 grid size-11 place-items-center rounded-full border border-line bg-surface/85 text-fg shadow-sm backdrop-blur-md transition-all hover:border-accent hover:bg-surface active:scale-95"
                aria-label={lang === "en" ? c.close.en : c.close.id}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <div className="relative overflow-hidden bg-surface2">
                <div ref={imgRef} className="cs-panel-img absolute inset-0 origin-bottom">
                  {open && (
                    <Image
                      src={d.photo ?? ""}
                      alt=""
                      width={1080}
                      height={1440}
                      sizes="(min-width:640px) 340px, 100vw"
                      className="absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 object-contain object-bottom"
                    />
                  )}
                </div>
              </div>
              <div className="relative flex flex-col justify-center gap-3.5 p-6 sm:p-8">
                <p className="cs-panel-item eyebrow">
                  <L v={d.role} />
                </p>
                <h3 className="cs-panel-item display text-3xl sm:text-4xl leading-tight">{d.name}</h3>
                <p className="cs-panel-item text-sm leading-relaxed text-muted">
                  <L v={d.bio} />
                </p>
                <ul className="cs-panel-item space-y-2 text-sm">
                  {d.focus.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                      <L v={f} />
                    </li>
                  ))}
                </ul>
                <a
                  href={wa ?? `/reservasi?dokter=${encodeURIComponent(d.name.replace(/^drg\.\s*/i, ""))}`}
                  {...(wa ? { target: "_blank", rel: "noopener noreferrer" } : { onClick: closeProfile })}
                  className="cs-panel-item btn btn-primary mt-2 self-start"
                >
                  <L v={c.book} />
                </a>
              </div>
            </div>
          </>,
          document.body
        )}
    </section>
  );
}

