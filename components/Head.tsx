"use client";

import { useRef } from "react";
import { MOTION_OK, SplitText, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import type { Bi } from "@/lib/content";

/** Section heading: eyebrow fades in, title words rise out of a mask, sub fades. */
export function Head({ eyebrow, title, sub }: { eyebrow: Bi; title: Bi; sub?: Bi }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!root.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        if (!root.current) return;
        const eyebrowEl = root.current.querySelector<HTMLElement>(".hd-eyebrow");
        const titleTargets = Array.from(root.current.querySelectorAll<HTMLElement>(".hd-title [data-l]"));
        const subEl = root.current.querySelector<HTMLElement>(".hd-sub");

        gsap.set(root.current, { opacity: 1 });
        const tl = gsap.timeline({ defaults: { ease: "power3.out" }, scrollTrigger: { trigger: root.current, start: "top 86%", once: true } });
        if (eyebrowEl) tl.from(eyebrowEl, { y: 18, opacity: 0, duration: 0.8 }, 0);

        let split: InstanceType<typeof SplitText> | null = null;
        if (titleTargets.length) {
          const s = SplitText.create(titleTargets, { aria: "none", type: "words", mask: "words" });
          split = s;
          if (s.words && s.words.length) {
            tl.from(s.words, { yPercent: 110, duration: 1.1, stagger: 0.05 }, 0.1);
          }
        }
        if (subEl) tl.from(subEl, { y: 18, opacity: 0, duration: 0.9 }, 0.5);
        return () => split?.revert();
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="hd max-w-2xl">
      <p className="eyebrow hd-eyebrow">
        <L v={eyebrow} />
      </p>
      <h2 className="display hd-title mt-4 text-[clamp(2.2rem,5vw,3.8rem)]">
        <L v={title} />
      </h2>
      {sub && (
        <p className="hd-sub mt-4 text-muted">
          <L v={sub} />
        </p>
      )}
    </div>
  );
}
