import crypto from "node:crypto";

export function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET (>= 32 chars) is required in production");
  return "dev-only-secret-change-me-dev-only-secret";
}
const primaryKeySecret = () => {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  return process.env.ENCRYPTION_KEY || secret();
};
const key = () => crypto.createHash("sha256").update(primaryKeySecret()).digest();

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}
export function decrypt(blob: string): string {
  if (!blob) return "";
  // If stored in raw Base32 format (16-64 chars uppercase/digits, no dots)
  if (/^[A-Z2-7]{16,64}$/.test(blob.trim())) {
    return blob.trim();
  }

  const parts = blob.split(".");
  if (parts.length !== 3) return blob;

  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ct) return "";

  // Candidates: primary secret (AUTH_SECRET), ENCRYPTION_KEY, and dev fallback
  const candidates: string[] = [];
  try {
    const s = secret();
    if (s) candidates.push(s);
  } catch {
    // fallback
  }
  if (process.env.AUTH_SECRET?.trim() && !candidates.includes(process.env.AUTH_SECRET.trim())) {
    candidates.push(process.env.AUTH_SECRET.trim());
  }
  if (process.env.ENCRYPTION_KEY?.trim() && !candidates.includes(process.env.ENCRYPTION_KEY.trim())) {
    candidates.push(process.env.ENCRYPTION_KEY.trim());
  }
  const devFallback = "dev-only-secret-change-me-dev-only-secret";
  if (!candidates.includes(devFallback)) candidates.push(devFallback);

  for (const cand of candidates) {
    try {
      const k = crypto.createHash("sha256").update(cand).digest();
      const d = crypto.createDecipheriv("aes-256-gcm", k, iv);
      d.setAuthTag(tag);
      const res = Buffer.concat([d.update(ct), d.final()]).toString("utf8");
      if (res) return res;
    } catch {
      // try next candidate
    }
  }

  throw new Error("Gagal mendekripsi kredensial: kunci enkripsi tidak cocok.");
}
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
export const randomId = () => crypto.randomBytes(12).toString("base64url");
