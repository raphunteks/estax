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
    const go = () => setOn("now");
    if (typeof window !== "undefined" && window.location.hash) {
      go();
      return;
    }

    const evs = ["scroll", "wheel", "pointerdown", "touchstart", "keydown", "hashchange"] as const;
    evs.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));

    let obs: IntersectionObserver | null = null;
    if (triggerRef.current && typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            go();
            obs?.disconnect();
          }
        },
        { rootMargin: "600px" }
      );
      obs.observe(triggerRef.current);
    }

    return () => {
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
    <div ref={triggerRef} aria-hidden="true" style={{ minHeight: "400vh" }}>
      {ANCHORS.map((a) => (
        <div key={a} id={a} />
      ))}
    </div>
  );
}
