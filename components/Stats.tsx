"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { L } from "./L";
import { doctors, journey, specialties, statsCopy } from "@/lib/content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Only real, derived numbers. Nothing here is invented. */
const items = [
  { n: doctors.length, label: statsCopy.doctors },
  { n: specialties.filter((s) => s.enabled).length, label: statsCopy.services },
  { n: journey.steps.length, label: statsCopy.steps },
];

export default function Stats() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const end = Number(el.dataset.count);
          const o = { v: 0 };
          el.textContent = "0";
          ScrollTrigger.create({
            trigger: el,
            start: "top 88%",
            once: true,
            onEnter: () =>
              gsap.to(o, { v: end, duration: 1.6, ease: "power2.out", onUpdate: () => (el.textContent = String(Math.round(o.v))) }),
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="stats" className="border-y border-line py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow" data-reveal>
          <L v={statsCopy.eyebrow} />
        </p>
        <dl className="mt-8 grid grid-cols-3 gap-4 text-center sm:gap-10">
          {items.map((it, i) => (
            <div key={i} data-reveal>
              <dd className="display text-[clamp(3rem,10vw,6rem)] text-accent" data-count={it.n}>
                {it.n}
              </dd>
              <dt className="mt-1 text-xs uppercase tracking-[0.18em] text-muted sm:text-sm">
                <L v={it.label} />
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
