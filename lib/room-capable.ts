/**
 * Decides whether this device gets the 3D "walk into the clinic" hero.
 * Anything that would make the experience slow, costly or uncomfortable keeps the static hero:
 * reduced motion, Save-Data, low memory or few cores, or no WebGL at all.
 */
export function roomCapable(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(location.search).get("room");
  if (q === "off") return false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const force = q === "on"; // QA override for slow test machines; still honours reduced motion and needs WebGL.
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (!force && nav.connection?.saveData) return false;
  if (!force && ((nav.deviceMemory ?? 8) < 4 || (nav.hardwareConcurrency ?? 8) < 4)) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}
