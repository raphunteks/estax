/**
 * De-identification before anything leaves the server for the AI gateway.
 * Removes what directly identifies a person: known names, phone numbers, e-mail, ID/NIK, RM numbers, full dates of birth-like dates.
 * It is a safety net for free text; structured context is built without identity in the first place.
 */
export function redact(text: string, names: string[] = []): string {
  let t = text;
  for (const n of names.flatMap((x) => x.split(/\s+/)).filter((w) => w.length >= 3)) t = t.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[nama]");
  return t
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/\b\d{16}\b/g, "[nik]")
    .replace(/(\+?62|0)[\s-]?8\d[\d\s-]{6,12}\d/g, "[telepon]")
    .replace(/\bRM[-\s]?\d[\w-]*/gi, "[no rm]")
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "[tanggal]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[tanggal]");
}

/** Prompt-injection hygiene: user text is wrapped as data and cannot close the wrapper. */
export const wrap = (tag: string, text: string, max = 8000) => `<${tag}>\n${text.slice(0, max).replace(/<\/?[a-z_]+>/gi, " ")}\n</${tag}>`;
