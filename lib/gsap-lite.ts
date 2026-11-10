"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Lightweight GSAP core for dashboard, portal, auth, and queue monitors (excludes ScrollTrigger, SplitText, DrawSVG, Inertia plugins).
gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

