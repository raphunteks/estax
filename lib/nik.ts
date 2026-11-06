/** Pure helpers shared by the wizard (client) and the register API (server). */
export function validNik(nik: string, birthDate: string): string | null {
  if (!/^\d{16}$/.test(nik)) return "NIK harus 16 digit.";
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const day = Number(nik.slice(6, 8));
  const mon = Number(nik.slice(8, 10));
  const yr = Number(nik.slice(10, 12));
  const dd = day > 40 ? day - 40 : day; // women encode day + 40
  if (dd !== d || mon !== m || yr !== y % 100) return "NIK tidak sesuai dengan tanggal lahir.";
  return null;
}
export const maskNik = (n: string) => (n.length >= 8 ? `${n.slice(0, 4)}${"•".repeat(n.length - 8)}${n.slice(-4)}` : "••••");
/** 0812..., 62812..., +62812... -> +62812... ; returns null if it does not look like an Indonesian mobile number. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const n = d.startsWith("62") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^8\d{8,11}$/.test(n) ? `+62${n}` : null;
}
export const ageOf = (birthDate: string, now = new Date()) => {
  const b = new Date(birthDate);
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
};
