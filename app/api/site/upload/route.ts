import sharp from "sharp";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { randomId } from "@/lib/auth/crypto";
import { saveObject } from "@/lib/storage";

const MAX = 6 * 1024 * 1024;
const MAGIC: number[][] = [[0xff, 0xd8, 0xff], [0x89, 0x50, 0x4e, 0x47], [0x52, 0x49, 0x46, 0x46]];

/** Landing images (team photo, before/after). Verified by magic bytes and re-encoded to WebP (drops EXIF/GPS). */
export async function POST(req: Request) {
  const a = await requirePerm("site:manage");
  if (isResponse(a)) return a;
  if (!(await rateLimit("site-upload", a.user.id, 40, 3600))) return fail("rate_limited", 429);
  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  const kind = form?.get("kind") === "team" ? "team" : "result";
  if (!(f instanceof File)) return fail("validation", 400, "Pilih berkas gambar.");
  if (f.size > MAX) return fail("too_large", 413, "Maksimal 6 MB.");
  const buf = Buffer.from(await f.arrayBuffer());
  if (!MAGIC.some((m) => m.every((b, i) => buf[i] === b))) return fail("bad_type", 415, "Gunakan JPG, PNG, atau WebP.");
  let out: Buffer;
  try {
    const img = sharp(buf).rotate();
    out = await (kind === "team" ? img.resize(720, 960, { fit: "cover", position: "top" }) : img.resize(1200, 900, { fit: "cover" })).webp({ quality: 80 }).toBuffer();
  } catch {
    return fail("bad_type", 415, "Gambar tidak dapat dibaca.");
  }
  const name = `${randomId().toLowerCase().replace(/[^a-z0-9]/g, "")}.webp`;
  await saveObject(`site/${name}`, out, "image/webp");
  await audit("site.upload", a.user.id, { name });
  return json({ ok: true, key: name });
}
