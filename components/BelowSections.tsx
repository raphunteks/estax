"use client";

import { Manifesto } from "@/components/Manifesto";
import DoctorSlider from "@/components/DoctorSlider";
import Services from "@/components/Services";
import Technology from "@/components/Technology";
import Journey from "@/components/Journey";
import { Results, Team, Testimonials } from "@/components/Social";
import Stats from "@/components/Stats";
import Faq from "@/components/Faq";
import Booking from "@/components/Booking";
import Global from "@/components/Global";
import { Location, Pricing } from "@/components/Sections";
import { useEffect, useState } from "react";
import { SiteProvider } from "@/lib/site-context";
import type { SiteContent } from "@/lib/site-types";

const LIST = [Manifesto, DoctorSlider, Team, Services, Technology, Journey, Results, Testimonials, Stats, Pricing, Faq, Location, Booking, Global];

/** Everything below the first screen, loaded as one async chunk by Below.tsx. `staged` mounts one section per tick. */
export default function BelowSections({ onReady, staged, site }: { onReady: () => void; staged: boolean; site: SiteContent }) {
  const [n, setN] = useState(staged ? 1 : LIST.length);
  useEffect(() => {
    if (n >= LIST.length) {
      const id = requestAnimationFrame(onReady);
      return () => cancelAnimationFrame(id);
    }
    const t = setTimeout(() => setN((x) => x + 1), 250);
    return () => clearTimeout(t);
  }, [n, onReady]);
  return (
    <SiteProvider value={site}>
      <div id="below">
        {LIST.slice(0, n).map((C, i) => (
          <C key={i} />
        ))}
      </div>
    </SiteProvider>
  );
}
