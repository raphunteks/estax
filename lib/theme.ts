/** Theme palettes. Tokens live in globals.css; this file only names them and resolves "Ikut Jam". */
export const THEMES = {
  siang: { label: "Siang", desc: "Krim dan kobalt", tone: "light", bar: "#f6f1e4", sw: ["#fbf7ea", "#1a3bb5"] },
  malam: { label: "Malam", desc: "Navy pekat", tone: "dark", bar: "#0a0d18", sw: ["#0f1426", "#8a9cff"] },
  aren: { label: "Aren", desc: "Gula aren dan espresso", tone: "light", bar: "#f4e8d0", sw: ["#e0b56a", "#9a4f1e"] },
  pandan: { label: "Pandan", desc: "Hijau segar", tone: "light", bar: "#eaf3ea", sw: ["#e8f2e8", "#2f6b4a"] },
  sunrise: { label: "Sunrise", desc: "Jingga dan plum", tone: "light", bar: "#fdeee3", sw: ["#fdeee3", "#b13c20"] },
} as const;
export type ThemeName = keyof typeof THEMES;
export type ThemePref = ThemeName | "auto";
export const THEME_KEYS = Object.keys(THEMES) as ThemeName[];

/** WITA (UTC+8) hour schedule used by "Ikut Jam". */
export function autoTheme(now = new Date()): ThemeName {
  const h = (now.getUTCHours() + 8) % 24;
  if (h >= 5 && h < 9) return "sunrise";
  if (h >= 9 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "aren";
  return "malam";
}

export function readPref(): ThemePref {
  try {
    const t = localStorage.getItem("theme");
    if (t === "light") return "siang"; // legacy values
    if (t === "dark") return "malam";
    if (t && t in THEMES) return t as ThemeName;
  } catch {}
  return "auto";
}

export function applyTheme(pref: ThemePref) {
  const name = pref === "auto" ? autoTheme() : pref;
  const d = document.documentElement;
  d.dataset.theme = name;
  d.dataset.pref = pref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[name].bar);
  try {
    localStorage.setItem("theme", pref);
  } catch {}
}
