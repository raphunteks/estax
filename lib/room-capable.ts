/**
 * Decides whether this device gets the 3D "walk into the clinic" hero.
 * As long as WebGL is supported and not explicitly disabled via ?room=off or prefers-reduced-motion,
 * the interactive 3D clinic room is delivered as the primary landing page experience.
 */
export function roomCapable(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(location.search).get("room");
  if (q === "off") return false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (c.getContext("webgl2") ?? c.getContext("webgl") ?? c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}
