"use client";

import { useEffect, useRef } from "react";
import { FINE_POINTER, MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/lib/gsap";

/** Section id -> its own URL. Scrolling the home page keeps the address bar on the matching route (no hash). */
const ID_ROUTE: Record<string, string> = { doctors: "/dokter", team: "/dokter", specialties: "/layanan", technology: "/teknologi", journey: "/teknologi", pricing: "/biaya", faq: "/faq", location: "/lokasi", reservasi: "/reservasi" };
const ROUTE_ID: Record<string, string> = { "/dokter": "doctors", "/layanan": "specialties", "/teknologi": "technology", "/biaya": "pricing", "/faq": "faq", "/lokasi": "location", "/reservasi": "reservasi", "/": "top" };

/**
 * Page-level motion: scroll progress, section reveals, nav hide/show, magnetic buttons, cursor follower.
 * Everything is inside matchMedia, so reduced motion gets the static page and cleanup is automatic.
 */
export default function Global() {
  const bar = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      // Scroll progress (transform only).
      gsap.set(bar.current, { scaleX: 0, transformOrigin: "left center" });
      gsap.to(bar.current, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
      });

      // Every section eases in as it scrolls into view (transform-only so text always maintains 100% WCAG contrast).
      gsap.utils.toArray<HTMLElement>("section[id]").forEach((sec) => {
        if (sec.id === "doctors" || sec.id === "top") return; // pinned / hero have their own scroll choreography
        const inner = sec.firstElementChild as HTMLElement | null;
        if (!inner) return;
        gsap.fromTo(inner, { y: 32 }, { y: 0, ease: "none", scrollTrigger: { trigger: sec, start: "top 96%", end: "top 62%", scrub: 0.4 } });
      });

      // Generic reveal for [data-reveal]. Elements inside other motion components opt out with data-own.
      ScrollTrigger.batch("[data-reveal]:not([data-own])", {
        start: "top 88%",
        once: true,
        onEnter: (els) =>
          gsap.to(els, { y: 0, duration: 0.85, ease: "power3.out", stagger: 0.06, overwrite: true, clearProps: "transform" }),
      });

      // Header hides on scroll down, returns on scroll up. Never hides while the menu is open.
      const header = document.querySelector<HTMLElement>("body > header, header");
      if (header) {
        const hide = gsap.quickTo(header, "yPercent", { duration: 0.45, ease: "power3.out" });
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            const menuOpen = header.querySelector("[aria-expanded='true']") !== null;
            hide(self.direction === 1 && self.scroll() > 240 && !menuOpen ? -110 : 0);
          },
        });
        const reveal = () => hide(0);
        header.addEventListener("focusin", reveal);
        return () => header.removeEventListener("focusin", reveal);
      }
    });

    // Desktop-only flourishes.
    mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
      const el = cursor.current;
      const cleanups: Array<() => void> = [];

      if (el) {
        gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0 });
        const x = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
        const y = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
        const onMove = (e: PointerEvent) => {
          x(e.clientX);
          y(e.clientY);
          gsap.to(el, { opacity: 1, duration: 0.3, overwrite: "auto" });
        };
        const onOver = (e: PointerEvent) => {
          const hot = (e.target as Element | null)?.closest("a, button, [data-cursor]");
          gsap.to(el, { scale: hot ? 2.4 : 1, duration: 0.35, ease: "power3.out", overwrite: "auto" });
        };
        const onLeave = () => gsap.to(el, { opacity: 0, duration: 0.3 });
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerover", onOver, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerover", onOver);
          document.documentElement.removeEventListener("pointerleave", onLeave);
        });
      }

      // Magnetic primary buttons.
      document.querySelectorAll<HTMLElement>(".btn-primary").forEach((btn) => {
        const mx = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
        const my = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect();
          mx((e.clientX - (r.left + r.width / 2)) * 0.25);
          my((e.clientY - (r.top + r.height / 2)) * 0.35);
        };
        const out = () => {
          mx(0);
          my(0);
        };
        btn.addEventListener("pointermove", move);
        btn.addEventListener("pointerleave", out);
        cleanups.push(() => {
          btn.removeEventListener("pointermove", move);
          btn.removeEventListener("pointerleave", out);
        });
      });

      return () => cleanups.forEach((fn) => fn());
    });

    void document.fonts?.ready.then(() => ScrollTrigger.refresh());
  });

  // Dynamic routing on the home page: the URL follows the section in view and internal section links scroll instead of reloading.
  useEffect(() => {
    if (location.pathname !== "/") return;
    const set = (path: string) => {
      if (location.pathname !== path) history.replaceState(history.state, "", path);
    };
    const triggers: ScrollTrigger[] = [ScrollTrigger.create({ start: 0, end: "max", onUpdate: (st) => st.scroll() < 200 && set("/") })];
    Object.entries(ID_ROUTE).forEach(([id, path]) => {
      const el = document.getElementById(id);
      if (el) triggers.push(ScrollTrigger.create({ trigger: el, start: "top 55%", end: "bottom 55%", onToggle: (st) => st.isActive && set(path) }));
    });
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!a || a.target === "_blank" || a.origin !== location.origin) return;
      const id = ROUTE_ID[a.pathname];
      const el = id && (id === "top" ? document.body : document.getElementById(id));
      if (!el || a.hash) return;
      e.preventDefault();
      const doc = new URLSearchParams(a.search).get("dokter");
      if (doc) window.dispatchEvent(new CustomEvent("estaka:doctor", { detail: doc }));
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (id === "top") window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      else el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      set(a.pathname);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      triggers.forEach((t) => t.kill());
    };
  }, []);

  return (
    <>
      <div ref={bar} className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left scale-x-0 bg-accent motion-reduce:hidden" aria-hidden="true" />
      <div
        ref={cursor}
        className="pointer-events-none fixed left-0 top-0 z-[70] hidden size-8 rounded-full border border-accent/70 opacity-0 mix-blend-normal [@media(hover:hover)_and_(pointer:fine)]:block motion-reduce:hidden"
        aria-hidden="true"
      />
    </>
  );
}
