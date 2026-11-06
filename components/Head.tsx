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
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create(".hd-title [data-l]", { aria: "none", type: "words", mask: "words" });
        gsap.set(root.current, { opacity: 1 });
        const tl = gsap.timeline({ defaults: { ease: "power3.out" }, scrollTrigger: { trigger: root.current, start: "top 86%", once: true } });
        tl.from(".hd-eyebrow", { y: 18, opacity: 0, duration: 0.8 }, 0);
        if (split.words.length) tl.from(split.words, { yPercent: 110, duration: 1.1, stagger: 0.05 }, 0.1);
        if (root.current?.querySelector(".hd-sub")) tl.from(".hd-sub", { y: 18, opacity: 0, duration: 0.9 }, 0.5);
        return () => split.revert();
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
