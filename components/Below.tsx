"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { registerWebMcp } from "@/lib/webmcp";
import type { SiteContent } from "@/lib/site-types";

const Sections = dynamic(() => import("@/components/BelowSections"), { ssr: false });
const ANCHORS = ["doctors", "team", "specialties", "technology", "journey", "results", "testimonials", "stats", "pricing", "faq", "location", "reservasi"];

/**
 * Mounts the below-the-fold sections on first user intent (scroll, pointer, touch, key, hash change)
 * or when the user scrolls near the fold (IntersectionObserver with 600px prefetch margin).
 */
export default function Below({ site }: { site: SiteContent }) {
  const [on, setOn] = useState<false | "now" | "staged">(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => registerWebMcp(), []);

  useEffect(() => {
    let mounted = false;
    const go = () => {
      if (mounted) return;
      mounted = true;
      setOn("now");
    };
    if (typeof window !== "undefined" && window.location.hash) {
      go();
      return;
    }

    const onScroll = () => {
      if (window.scrollY > 8) go();
    };
    const evs = ["wheel", "pointerdown", "touchstart", "keydown", "hashchange"] as const;
    window.addEventListener("scroll", onScroll, { passive: true });
    evs.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));

    let obs: IntersectionObserver | null = null;
    if (triggerRef.current && typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver(
        (entries) => {
          if (window.scrollY > 8 && entries.some((e) => e.isIntersecting)) {
            go();
            obs?.disconnect();
          }
        },
        { rootMargin: "120px" }
      );
      obs.observe(triggerRef.current);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      evs.forEach((e) => window.removeEventListener(e, go));
      obs?.disconnect();
    };
  }, []);

  const ready = () => {
    // Deep links: scroll to the real element once it exists, then let ScrollTrigger recompute pins.
    import("@/lib/gsap").then(({ ScrollTrigger }) => {
      ScrollTrigger.refresh();
      const id = decodeURIComponent(location.hash.slice(1));
      if (id) document.getElementById(id)?.scrollIntoView();
    });
  };

  if (on) return <Sections onReady={ready} staged={on === "staged"} site={site} />;
  return (
    <div ref={triggerRef} style={{ minHeight: "200vh" }}>
      {ANCHORS.map((a) => (
        <div key={a} id={a} aria-hidden="true" />
      ))}
      <form
        action="/reservasi"
        method="get"
        toolname="book_appointment"
        tooldescription="Formulir cepat untuk mulai membuat janji temu dokter gigi secara online di Estaka Dental Clinic Makassar."
        className="sr-only"
      >
        <label htmlFor="quick-bk-dokter">Pilih dokter gigi</label>
        <input
          id="quick-bk-dokter"
          name="dokter"
          type="text"
          toolparamdescription="Nama dokter gigi yang ingin dipilih untuk reservasi janji temu (opsional)."
        />
        <button type="submit">Buat janji temu</button>
      </form>
    </div>
  );
}
