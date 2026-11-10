"use client";

import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import { Head } from "./Head";
import { journey } from "@/lib/content";

/** Scrubbed timeline: the line draws as you scroll and each step lights up when the line reaches it. */
export default function Journey() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const steps = gsap.utils.toArray<HTMLElement>(".jr-step");
        const n = steps.length;
        gsap.set(".jr-node", { scale: 0.75 });
        gsap.set(".jr-body", { y: 20 });
        const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: ".jr-list", start: "top 75%", end: "bottom 60%", scrub: 0.7 } });
        tl.fromTo(".jr-line-h", { scaleX: 0 }, { scaleX: 1, duration: n }, 0).fromTo(".jr-line-v", { scaleY: 0 }, { scaleY: 1, duration: n }, 0);
        steps.forEach((s, i) => {
          const at = i * (n / (n - 0.2)) * 0.9;
          tl.to(s.querySelector(".jr-node"), { scale: 1, duration: 0.5, ease: "back.out(2)" }, at)
            .to(s.querySelector(".jr-body"), { y: 0, duration: 0.6, ease: "power3.out" }, at + 0.1);
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="journey" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head eyebrow={journey.eyebrow} title={journey.title} />
        <ol className="jr-list relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          <span className="jr-line-h absolute left-6 right-6 top-6 hidden h-px origin-left bg-accent md:block" aria-hidden="true" />
          <span className="jr-line-v absolute bottom-6 left-6 top-6 w-px origin-top bg-accent md:hidden" aria-hidden="true" />
          {journey.steps.map((s, i) => (
            <li key={i} className="jr-step relative pl-16 md:pl-0 md:pt-16">
              <span className="jr-node display absolute left-0 top-0 grid size-12 place-items-center rounded-full border border-accent bg-bg text-2xl text-accent">{i + 1}</span>
              <div className="jr-body">
                <h3 className="text-lg font-semibold">
                  <L v={s.title} />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  <L v={s.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
