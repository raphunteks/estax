/** Client-safe helpers for site content (no zod, so the landing bundle stays small). */
import type { SiteContent } from "./site-types";

export const DEFAULT_WA_TEMPLATE = "Halo {nama}, ini pengingat janji Anda di {klinik}: {tanggal} pukul {jam} dengan {dokter}. Balas pesan ini bila ingin mengubah atau membatalkan jadwal. Terima kasih.";

export const emptySite = (): SiteContent => ({ clinic: {}, team: [], results: [], testimonials: [], wa: { enabled: true, template: DEFAULT_WA_TEMPLATE, hoursBefore: 24 } });

/** Google Maps embed URL from a free-text address (no API key needed). Only https google hosts are ever returned. */
const EMBED_RE = /^https:\/\/www\.google\.com\/maps\/embed\?[^\s"'<>]{10,1800}$/;
/** Accepts a pasted <iframe> snippet or a bare URL; returns the Google Maps embed src or null. Anything else is dropped. */
export function cleanMapEmbed(input?: string): string | null {
  const t = (input ?? "").trim();
  if (!t) return null;
  const src = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? t;
  const url = src.replace(/&amp;/g, "&");
  return EMBED_RE.test(url) ? url : null;
}
/** Used until an admin sets another one in the dashboard. */
export const DEFAULT_MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1268.5831923047183!2d119.41615136093179!3d-5.171323888328667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dbf1d71cf75a47d%3A0xa90a84353b81134a!2sJl.%20Andi%20Tonro%20Blok%20F%20No.30%2C%20Bongaya%2C%20Kec.%20Tamalate%2C%20Kota%20Makassar%2C%20Sulawesi%20Selatan%2090131!5e0!3m2!1sid!2sid!4v1793919865041!5m2!1sid!2sid";

export function mapEmbedSrc(c: SiteContent["clinic"], fallbackAddress?: string): string | null {
  const own = cleanMapEmbed(c.mapsEmbed);
  if (own) return own;
  if (!c.mapsQuery?.trim()) return DEFAULT_MAP_EMBED;
  const q = c.mapsQuery?.trim() || c.address?.trim() || fallbackAddress?.trim();
  if (!q) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}
export const siteImg = (key?: string) => (key ? `/api/files/site/${key}` : "");

export function fillWa(template: string, v: { nama: string; tanggal: string; jam: string; dokter: string; klinik: string }) {
  return template.replace(/\{(nama|tanggal|jam|dokter|klinik)\}/g, (_, k: keyof typeof v) => v[k]);
}
