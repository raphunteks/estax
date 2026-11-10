"use client";

import { useRef } from "react";
import { MOTION_OK, SplitText, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import { manifesto } from "@/lib/content";

/** Pinned manifesto: words light up one by one, scrubbed to scroll. */
export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create(".mf-text [data-l]", { aria: "none", type: "words", wordsClass: "mf-w" });
        gsap.set(split.words, { color: "var(--muted)" });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: root.current, start: "top top", end: "+=130%", pin: true, scrub: 0.7, anticipatePin: 1 },
        });
        tl.from(".mf-eyebrow", { y: 16, duration: 0.15, ease: "none" }, 0)
          .to(split.words, { color: "var(--fg)", stagger: 0.1, ease: "none", duration: 0.1 }, 0.05)
          .fromTo(".mf-line", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 1 }, 0)
          .fromTo(".mf-orb", { scale: 0.7, rotate: -20 }, { scale: 1.15, rotate: 30, ease: "none", duration: 1 }, 0);
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative grid min-h-dvh place-items-center overflow-hidden px-4 sm:px-6" aria-labelledby="mf-h">
      <div className="mf-orb pointer-events-none absolute size-[70vmin] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl">
        <p id="mf-h" className="eyebrow mf-eyebrow">
          <L v={manifesto.eyebrow} />
        </p>
        <p className="display mf-text mt-6 text-[clamp(1.9rem,5.2vw,4.4rem)] leading-[1.08]">
          <L v={manifesto.text} />
        </p>
        <span className="mf-line mt-10 block h-px origin-left bg-accent" aria-hidden="true" />
      </div>
    </section>
  );
}
