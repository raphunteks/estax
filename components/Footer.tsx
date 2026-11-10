"use client";

import { useRef } from "react";
import { useLazyGsap } from "@/lib/use-gsap-lazy";
import { L } from "./L";
import { clinic, footerCopy } from "@/lib/content";
import { PAGES } from "@/lib/seo";
import { useLang } from "@/lib/lang";

/** Footer with a giant wordmark whose letters rise out of a mask when it enters the viewport. */
export default function Footer() {
  const root = useRef<HTMLElement>(null);
  const lang = useLang();

  useLazyGsap(root, ({ gsap, SplitText, MOTION_OK }) => {
    {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create(".ft-mark", { aria: "none", type: "chars", mask: "chars" });
        gsap.from(split.chars, { yPercent: 110, duration: 1.4, stagger: 0.07, ease: "power4.out", scrollTrigger: { trigger: root.current, start: "top 75%", once: true } });
        gsap.from(".ft-meta", { y: 20, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: root.current, start: "top 70%", once: true } });
        gsap.fromTo(".ft-glow", { y: -60 }, { y: 60, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom bottom", scrub: 0.8 } });
        return () => split.revert();
      });
    }
  });

  return (
    <footer ref={root} className="relative overflow-hidden border-t border-line pt-16">
      <div className="ft-glow pointer-events-none absolute -bottom-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }} aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl gap-6 px-4 text-sm text-muted sm:px-6 md:grid-cols-2 md:items-end">
        <p className="ft-meta max-w-md">
          <L v={footerCopy.disclaimer} />
        </p>
        <div className="ft-meta md:text-right">
          <p>
            <L v={footerCopy.privacy} />
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()} {clinic.name}. <L v={footerCopy.rights} />
          </p>
        </div>
      </div>
      <nav aria-label={lang === "en" ? footerCopy.sitemapAria.en : footerCopy.sitemapAria.id} className="relative mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {Object.values(PAGES).map((p) => (
            <li key={p.path}><a href={p.path} className="inline-flex min-h-11 items-center transition-colors hover:text-fg"><L v={p.nameBi} /></a></li>
          ))}
        </ul>
      </nav>
      <p className="ft-mark display relative select-none overflow-hidden px-4 pt-6 text-center text-[clamp(5rem,24vw,22rem)] leading-[0.85] text-fg" aria-hidden="true">
        Estaka<span className="text-accent">.</span>
      </p>
    </footer>
  );
}
