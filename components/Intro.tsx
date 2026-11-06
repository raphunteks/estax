"use client";

import { useRef } from "react";
import { useLazyGsap } from "@/lib/use-gsap-lazy";
import { L } from "./L";
import { marquee } from "@/lib/content";

/** Infinite marquee. Scroll velocity speeds it up and skews it slightly, like Ivory's ticker. */
export function Marquee() {
  const root = useRef<HTMLDivElement>(null);

  useLazyGsap(root, ({ gsap, ScrollTrigger, MOTION_OK }) => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const track = root.current?.querySelector<HTMLElement>(".mq-track");
        if (!track) return;
        track.style.animation = "none"; // CSS marquee ran until now; GSAP takes over for velocity effects
        const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
        const skew = gsap.quickTo(track, "skewX", { duration: 0.4, ease: "power3.out" });
        const st = ScrollTrigger.create({ start: 0, end: "max" });
        let dir = 1;
        let speed = 1;
        const tick = () => {
          const v = gsap.utils.clamp(-2200, 2200, st.getVelocity());
          if (Math.abs(v) > 30) dir = v > 0 ? 1 : -1;
          speed += (1 + Math.abs(v) / 500 - speed) * 0.12; // ease toward target speed
          loop.timeScale(dir * speed);
          skew(-v / 260);
        };
        gsap.ticker.add(tick);
        return () => {
          gsap.ticker.remove(tick);
          st.kill();
        };
      });
  });

  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {marquee.map((m, i) => (
        <li key={i} className="flex items-center">
          <span className="display px-8 text-[clamp(2rem,5vw,3.6rem)] text-fg/90">
            <L v={m} />
          </span>
          <span className="text-accent" aria-hidden="true">✦</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={root} className="overflow-hidden border-y border-line py-6" role="region" aria-label="Services">
      <div className="mq-track flex w-max will-change-transform">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
