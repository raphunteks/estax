"use client";

import { createContext, useContext } from "react";
import { emptySite } from "@/lib/site-helpers";
import type { SiteContent } from "@/lib/site-types";

const Ctx = createContext<SiteContent>(emptySite());
export const SiteProvider = Ctx.Provider;
export const useSite = () => useContext(Ctx);
