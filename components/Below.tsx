"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { registerWebMcp } from "@/lib/webmcp";
import type { SiteContent } from "@/lib/site-types";

const Sections = dynamic(() => import("@/components/BelowSections"), { ssr: false });
const ANCHORS = ["doctors", "team", "specialties", "technology", "journey", "results", "testimonials", "stats", "pricing", "faq", "location", "reservasi"];

/**
 * Mounts the below-the-fold sections on first user intent (scroll, pointer, touch, key, hash change) or after a
 * plain timer (mounted section by section so no single long task). The timer is a setTimeout on purpose: requestIdleCallback fires right after load and would pull
 * everything into the initial paint window.
 */
export default function Below({ site }: { site: SiteContent }) {
  const [on, setOn] = useState<false | "now" | "staged">(false);

  useEffect(() => registerWebMcp(), []);

  useEffect(() => {
    const go = () => setOn("now");
    const evs = ["scroll", "pointerdown", "touchstart", "keydown", "hashchange"] as const;
    evs.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    const t = setTimeout(() => setOn((o) => o || "staged"), 9000);
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, go));
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
    <div aria-hidden="true" style={{ minHeight: "400vh" }}>
      {ANCHORS.map((a) => (
        <div key={a} id={a} />
      ))}
    </div>
  );
}
