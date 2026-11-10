"use client";

import { useRef } from "react";
import Link from "next/link";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap-lite";
import Logo from "@/components/Logo";

export const inputCls =
  "mt-1.5 min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-base outline-none transition-colors duration-150 focus:border-accent";
export const btnCls = "btn btn-primary w-full disabled:opacity-50";

/** Centered auth card. Enters with a short ease-out rise (rare event, 400ms); static under reduced motion. */
export function AuthShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(".au-card", { y: 14, opacity: 0, scale: 0.98, duration: 0.45, ease: "power3.out" });
        gsap.from(".au-in", { y: 8, opacity: 0, duration: 0.4, stagger: 0.05, delay: 0.1, ease: "power3.out", clearProps: "all" });
      });
    },
    { scope: root },
  );
  return (
    <main ref={root} className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-1/3 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }} />
      </div>
      <div className="au-card glass w-full max-w-md rounded-3xl p-7 sm:p-9" style={{ backdropFilter: "blur(24px) saturate(160%)" }}>
        <Link href="/" className="au-in inline-flex items-center gap-2 text-accent" aria-label="Estaka Dental Clinic">
          <Logo size={34} />
          <span className="display text-2xl text-fg">Estaka</span>
        </Link>
        <h1 className="au-in display mt-6 text-3xl">{title}</h1>
        {sub && <p className="au-in mt-2 text-sm text-muted">{sub}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

/** Small shake for wrong input: rare feedback, 280ms. Skipped when reduced motion is on. */
export function shake(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.fromTo(el, { x: -6 }, { x: 0, duration: 0.28, ease: "elastic.out(1, 0.35)", clearProps: "x" });
}
