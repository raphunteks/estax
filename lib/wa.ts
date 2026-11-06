import { clinic } from "./content";

/** Build a wa.me link, or undefined when no WhatsApp number is configured. */
export function waLink(text?: string, number?: string): string | undefined {
  const n = number || clinic.whatsapp;
  if (!n) return undefined;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Indonesian phone to international digits (08.. / 8.. / 62.. all become 62..). Empty when it cannot be a mobile number. */
export function waPhone(p?: string): string {
  const d = (p ?? "").replace(/\D/g, "");
  const n = d.startsWith("62") ? d : d.startsWith("0") ? `62${d.slice(1)}` : d.startsWith("8") ? `62${d}` : "";
  return /^628\d{7,12}$/.test(n) ? n : "";
}
