"use client";

import { useRef, useState } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import { Head } from "./Head";
import { faq } from "@/lib/content";

/** Accordion animated by GSAP. Every item can be opened or closed mid-animation (latest request wins). */
export default function Faq() {
  const root = useRef<HTMLElement>(null);
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".fq-item", { y: 20, duration: 0.75, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: ".fq-list", start: "top 85%", once: true } });
        gsap.from(".fq-line", { scaleX: 0, transformOrigin: "left", duration: 1.0, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: ".fq-list", start: "top 85%", once: true } });
      });
    },
    { scope: root },
  );

  const animate = contextSafe((item: HTMLElement, willOpen: boolean, reduce: boolean) => {
    const d = reduce ? 0.01 : 0.55;
    gsap.to(item.querySelector(".fq-panel"), { gridTemplateRows: willOpen ? "1fr" : "0fr", duration: d, ease: "power3.out", overwrite: "auto" });
    gsap.to(item.querySelector(".fq-text"), { opacity: willOpen ? 1 : 0, y: willOpen ? 0 : -8, duration: reduce ? 0.01 : 0.4, delay: willOpen && !reduce ? 0.08 : 0, overwrite: "auto" });
    gsap.to(item.querySelector(".fq-plus"), { rotation: willOpen ? 45 : 0, duration: d, ease: "power3.out", overwrite: "auto" });
  });

  const toggle = (i: number) => {
    const item = root.current?.querySelectorAll<HTMLElement>(".fq-item")[i];
    if (!item) return;
    const willOpen = !openSet.has(i);
    animate(item, willOpen, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setOpenSet((s) => {
      const next = new Set(s);
      if (willOpen) next.add(i);
      else next.delete(i);
      return next;
    });
  };

  return (
    <section ref={root} id="faq" className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Head eyebrow={faq.eyebrow} title={faq.title} />
        <div className="fq-list">
          {faq.items.map((f, i) => (
            <div key={i} className="fq-item relative">
              <span className="fq-line absolute inset-x-0 top-0 h-px bg-line" aria-hidden="true" />
              <h3>
                <button type="button" id={`fq-b-${i}`} aria-expanded={openSet.has(i)} aria-controls={`fq-p-${i}`} onClick={() => toggle(i)} className="flex min-h-14 w-full items-center justify-between gap-6 py-5 text-left text-lg font-medium" data-cursor>
                  <span>
                    <L v={f.q} />
                  </span>
                  <span className="fq-plus grid size-8 shrink-0 place-items-center rounded-full border border-line text-accent" aria-hidden="true">
                    +
                  </span>
                </button>
              </h3>
              <div id={`fq-p-${i}`} role="region" aria-labelledby={`fq-b-${i}`} aria-hidden={!openSet.has(i)} inert={!openSet.has(i)} className="fq-panel grid" style={{ gridTemplateRows: "0fr" }}>
                <div className="overflow-hidden">
                  <p className="fq-text max-w-xl pb-6 leading-relaxed text-muted">
                    <L v={f.a} />
                  </p>
                </div>
              </div>
            </div>
          ))}
          <span className="block h-px bg-line" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
