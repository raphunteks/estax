"use client";

import { useSyncExternalStore } from "react";

export type Lang = "id" | "en";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
  return () => mo.disconnect();
}

/** Current UI language, driven by html[data-lang]. */
export function useLang(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.lang === "en" ? "en" : "id"),
    () => "id",
  );
}

export function setLang(lang: Lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem("lang", lang);
  } catch {
    /* storage may be blocked */
  }
}

