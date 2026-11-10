"use client";

import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import { Head } from "./Head";
import { technology } from "@/lib/content";

// Twelve teeth placed along a parabolic arch (computed once, no runtime layout).
const ARCH = Array.from({ length: 12 }, (_, i) => {
  const t = i / 11;
  const x = Math.round((30 + t * 240) * 100) / 100;
  const y = Math.round((150 - 110 * (1 - Math.pow(2 * t - 1, 2)) ** 0.8) * 100) / 100;
  return { x, y, r: i === 5 || i === 6 ? 11 : 9 };
});

function ScanScene() {
  return (
    <svg viewBox="0 0 300 180" className="h-auto w-full text-accent" fill="none" aria-hidden="true">
      <path className="tc-draw" d="M30 150C30 40 270 40 270 150" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
      <path className="tc-draw" d="M52 150C52 66 248 66 248 150" stroke="var(--line)" strokeWidth="1" />
      {ARCH.map((p, i) => (
        <circle key={i} className="tc-dot" cx={p.x} cy={p.y} r={p.r} stroke="currentColor" strokeWidth="1.2" fill="var(--card)" />
      ))}
      <rect className="tc-scan" x="20" y="30" width="2" height="128" fill="currentColor" />
      <rect className="tc-scan-glow" x="14" y="30" width="14" height="128" fill="currentColor" opacity="0.12" />
    </svg>
  );
}

function DesignScene() {
  return (
    <svg viewBox="0 0 300 180" className="h-auto w-full text-accent" fill="none" aria-hidden="true">
      <path className="tc-draw" d="M150 20V160" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
      <path className="tc-draw" d="M20 78H280" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 62 + i * 32;
        const mid = i === 2 || i === 3;
        return <rect key={i} className="tc-draw" x={x} y={mid ? 70 : 74} width={mid ? 30 : 26} height={mid ? 44 : 38} rx="9" stroke="currentColor" strokeWidth="1.4" fill="var(--card)" />;
      })}
      <path className="tc-draw" d="M36 132Q150 178 264 132" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle className="tc-dot" cx="36" cy="132" r="3.5" fill="currentColor" />
      <circle className="tc-dot" cx="150" cy="155" r="3.5" fill="currentColor" />
      <circle className="tc-dot" cx="264" cy="132" r="3.5" fill="currentColor" />
    </svg>
  );
}

/** Two illustrated cards. Lines draw in (DrawSVG), points pop, and the scan bar runs only while visible. */
export default function Technology() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>(".tc-card").forEach((card, ci) => {
          const q = gsap.utils.selector(card);
          const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 80%", once: true }, defaults: { ease: "power3.out" } });
          tl.from(card, { y: 36, duration: 0.85 }, 0)
            .from(q(".tc-draw"), { drawSVG: "0%", duration: 1.6, stagger: 0.1, ease: "power2.inOut" }, 0.15)
            .from(q(".tc-dot"), { scale: 0, transformOrigin: "50% 50%", duration: 0.5, stagger: 0.04, ease: "back.out(2)" }, 0.4)
            .from(q(".tc-text"), { y: 16, duration: 0.75, stagger: 0.08 }, 0.3);

          const scan = q(".tc-scan, .tc-scan-glow");
          if (scan.length) {
            gsap.fromTo(scan, { x: 0 }, { x: 258, duration: 2.6, ease: "sine.inOut", repeat: -1, yoyo: true, scrollTrigger: { trigger: card, toggleActions: "play pause resume pause" } });
          }
          // Slow depth drift while scrolling.
          gsap.fromTo(q(".tc-art"), { y: 20 * (ci ? -1 : 1) }, { y: 20 * (ci ? 1 : -1), ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: 0.8 } });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="technology" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head eyebrow={technology.eyebrow} title={technology.title} />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {technology.items.map((t, i) => (
            <article key={t.id} className="tc-card glass relative overflow-hidden rounded-3xl p-8">
              <div className="tc-art mb-6 rounded-2xl border border-line bg-bg/50 p-5">{i === 0 ? <ScanScene /> : <DesignScene />}</div>
              <h3 className="tc-text display text-3xl">
                <L v={t.title} />
              </h3>
              <p className="tc-text mt-3 max-w-md leading-relaxed text-muted">
                <L v={t.text} />
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
