"use client";

import { useEffect, type RefObject } from "react";

type G = typeof import("@/lib/gsap");

/**
 * Like useGSAP, but loads GSAP in a separate chunk after hydration so first paint does not pay for it.
 * The setup runs inside a gsap.context scoped to `scope` and is reverted on unmount.
 */
export function useLazyGsap(scope: RefObject<HTMLElement | null>, setup: (g: G) => void | (() => void)) {
  useEffect(() => {
    let dead = false;
    let started = false;
    let ctx: { revert: () => void } | undefined;
    const evs = ["scroll", "wheel", "pointermove", "pointerdown", "touchstart", "keydown"] as const;
    const start = () => {
      if (started) return;
      started = true;
      evs.forEach((e) => window.removeEventListener(e, start));
      import("@/lib/gsap").then((g) => {
        if (!dead) ctx = g.gsap.context(() => setup(g), scope.current ?? undefined);
      });
    };
    // GSAP only adds depth effects, so it waits for the first user intent and stays completely out of the load-time main thread budget.
    evs.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));
    return () => {
      dead = true;
      evs.forEach((e) => window.removeEventListener(e, start));
      ctx?.revert();
    };
    // setup is intentionally captured once per mount, like useGSAP without dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
