"use client";

import { useRef } from "react";
import { FINE_POINTER, MOTION_OK, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import { Head } from "./Head";
import { specialties, specialtiesCopy } from "@/lib/content";

/** Service cards: staggered rise on scroll, number parallax, pointer tilt + cursor spotlight on desktop. */
export default function Services() {
  const root = useRef<HTMLElement>(null);
  const list = specialties.filter((s) => s.enabled);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          ".sv-card",
          { y: 70, opacity: 0, rotationX: -8, transformPerspective: 900 },
          { y: 0, opacity: 1, rotationX: 0, duration: 1.1, stagger: 0.14, ease: "power3.out", scrollTrigger: { trigger: ".sv-grid", start: "top 82%", once: true } },
        );
        gsap.utils.toArray<HTMLElement>(".sv-num").forEach((n) =>
          gsap.fromTo(n, { yPercent: 25 }, { yPercent: -25, ease: "none", scrollTrigger: { trigger: n, start: "top bottom", end: "bottom top", scrub: 0.6 } }),
        );
        gsap.fromTo(".sv-rule", { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power3.out", scrollTrigger: { trigger: ".sv-grid", start: "top 85%", once: true } });
      });

      mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
        const cleanups: Array<() => void> = [];
        gsap.utils.toArray<HTMLElement>(".sv-card").forEach((card) => {
          const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3.out" });
          const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3.out" });
          const move = (e: PointerEvent) => {
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            ry((px - 0.5) * 8);
            rx(-(py - 0.5) * 8);
            card.style.setProperty("--mx", `${px * 100}%`);
            card.style.setProperty("--my", `${py * 100}%`);
          };
          const leave = () => (rx(0), ry(0));
          card.addEventListener("pointermove", move);
          card.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            card.removeEventListener("pointermove", move);
            card.removeEventListener("pointerleave", leave);
          });
        });
        return () => cleanups.forEach((fn) => fn());
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="specialties" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head {...specialtiesCopy} />
        <span className="sv-rule mt-10 block h-px origin-left bg-line" aria-hidden="true" />
        <div className="sv-grid mt-10 grid gap-5 md:grid-cols-2" style={{ perspective: "1200px" }}>
          {list.map((s, i) => (
            <article key={s.id} className="sv-card spot glass group relative overflow-hidden rounded-3xl p-8 sm:p-10">
              <span className="sv-num display pointer-events-none absolute -right-2 -top-4 select-none text-[8rem] leading-none text-accent/15" aria-hidden="true">
                0{i + 1}
              </span>
              <h3 className="display relative mt-16 text-4xl">
                <L v={s.title} />
              </h3>
              <p className="relative mt-4 max-w-md leading-relaxed text-muted">
                <L v={s.text} />
              </p>
              <span className="relative mt-8 inline-flex items-center gap-2 text-sm text-accent" aria-hidden="true">
                <span className="h-px w-8 bg-accent transition-[width] duration-500 group-hover:w-16" />
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
