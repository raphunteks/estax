"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap";
import { L } from "./L";
import { Head } from "./Head";
import { extraCopy as c } from "@/lib/content";
import { useSite } from "@/lib/site-context";
import { siteImg } from "@/lib/site-helpers";

/** Our team: cards rise in with a stagger. Hidden until real members are added in lib/content.ts. */
/** Empty data renders nothing at all, so no animation targets (or scope) are created for it. */
export function Team() {
  const team = useSite().team;
  if (!team || !team.length) return null;
  return <TeamInner team={team} />;
}
function TeamInner({ team }: { team: ReturnType<typeof useSite>["team"] }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      const grid = root.current.querySelector(".tm-grid");
      const cards = root.current.querySelectorAll(".tm-card");
      if (!grid || !cards.length) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(cards, { y: 60, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: grid, start: "top 82%", once: true } });
      });
    },
    { scope: root, dependencies: [team.length] },
  );
  return (
    <section ref={root} id="team" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head {...c.team} />
        <ul className="tm-grid mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {team.map((m) => (
            <li key={m.id} className="tm-card group">
              <div className="glass relative aspect-[3/4] overflow-hidden rounded-3xl">
                {m.photo ? <Image src={siteImg(m.photo)} alt={m.name} unoptimized fill sizes="(min-width:768px) 25vw, 50vw" className="object-cover object-top transition-transform duration-700 group-hover:scale-105" /> : <span aria-hidden="true" className="grid size-full place-items-center text-4xl text-muted">{m.name.slice(0, 1)}</span>}
              </div>
              <p className="mt-3 font-semibold">{m.name}</p>
              <p className="text-sm text-muted">
                <L v={{ id: m.roleId, en: m.roleEn || m.roleId }} />
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Before/after comparison. Divider follows the pointer 1:1; keyboard arrows work too. */
function Compare({ before, after, label }: { before: string; after: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPct(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={box}
      className="relative aspect-[4/3] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-3xl border border-line"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      <Image src={after} alt={`${label} - ${c.results.after.id}`} unoptimized fill sizes="50vw" className="pointer-events-none object-cover" draggable={false} />
      <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        <Image src={before} alt={`${label} - ${c.results.before.id}`} unoptimized fill sizes="50vw" className="object-cover" draggable={false} />
      </div>
      <span className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: `${pct}%` }} />
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPct((v) => Math.max(0, v - 5));
          if (e.key === "ArrowRight") setPct((v) => Math.min(100, v + 5));
        }}
        className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-ink"
        style={{ left: `${pct}%` }}
      >
        <span aria-hidden="true">↔</span>
      </button>
    </div>
  );
}

/** Empty data renders nothing at all, so no animation targets (or scope) are created for it. */
export function Results() {
  const results = useSite().results.filter((r) => r.before && r.after);
  if (!results.length) return null;
  return <ResultsInner results={results} />;
}
function ResultsInner({ results }: { results: ReturnType<typeof useSite>["results"] }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      const grid = root.current.querySelector(".rs-grid");
      const items = root.current.querySelectorAll(".rs-item");
      if (!grid || !items.length) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(items, { y: 50, opacity: 0, duration: 1, stagger: 0.12, ease: "power3.out", scrollTrigger: { trigger: grid, start: "top 82%", once: true } });
      });
    },
    { scope: root, dependencies: [results.length] },
  );
  return (
    <section ref={root} id="results" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head {...c.results} sub={c.results.hint} />
        <div className="rs-grid mt-12 grid gap-6 md:grid-cols-2">
          {results.map((r) => (
            <figure key={r.id} className="rs-item">
              <Compare before={siteImg(r.before)} after={siteImg(r.after)} label={r.titleId} />
              <figcaption className="mt-3 text-sm text-muted">
                <L v={{ id: r.titleId, en: r.titleEn || r.titleId }} />
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted">
          <L v={c.results.disclaimer} />
        </p>
      </div>
    </section>
  );
}

/** Empty data renders nothing at all, so no animation targets (or scope) are created for it. */
export function Testimonials() {
  const testimonials = useSite().testimonials;
  if (!testimonials.length) return null;
  return <TestimonialsInner testimonials={testimonials} />;
}
function TestimonialsInner({ testimonials }: { testimonials: ReturnType<typeof useSite>["testimonials"] }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      const grid = root.current.querySelector(".ts-grid");
      const cards = root.current.querySelectorAll(".ts-card");
      if (!grid || !cards.length) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(cards, { y: 50, opacity: 0, duration: 1, stagger: 0.12, ease: "power3.out", scrollTrigger: { trigger: grid, start: "top 82%", once: true } });
      });
    },
    { scope: root, dependencies: [testimonials.length] },
  );
  return (
    <section ref={root} id="testimonials" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head {...c.testimonials} />
        <div className="ts-grid mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote key={t.id} className="ts-card glass rounded-3xl p-7">
              <p className="display text-2xl leading-snug">
                “{t.quote}”
              </p>
              <footer className="mt-5 text-sm text-muted">{t.name}{t.treatment ? ` · ${t.treatment}` : ""}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
