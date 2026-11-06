import sharp from "sharp";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { getUser, saveUser } from "@/lib/auth/users";
import { removeObject, saveObject } from "@/lib/storage";

const MAX = 3 * 1024 * 1024;
const MAGIC: [string, number[]][] = [["jpeg", [0xff, 0xd8, 0xff]], ["png", [0x89, 0x50, 0x4e, 0x47]], ["webp", [0x52, 0x49, 0x46, 0x46]]];

/** Profile photo for every role. Content is verified by magic bytes, then re-encoded to 512px WebP (drops EXIF and GPS). */
export async function POST(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  if (!(await rateLimit("photo", a.user.id, 10, 3600))) return fail("rate_limited", 429);
  const f = (await req.formData().catch(() => null))?.get("file");
  if (!(f instanceof File)) return fail("validation", 400, "Pilih berkas gambar.");
  if (f.size > MAX) return fail("too_large", 413, "Maksimal 3 MB.");
  const buf = Buffer.from(await f.arrayBuffer());
  if (!MAGIC.some(([, m]) => m.every((b, i) => buf[i] === b))) return fail("bad_type", 415, "Gunakan JPG, PNG, atau WebP.");
  let out: Buffer;
  try {
    out = await sharp(buf).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  } catch {
    return fail("bad_type", 415, "Gambar tidak dapat dibaca.");
  }
  const key = `avatar/${a.user.id}`;
  await saveObject(key, out, "image/webp");
  const u = await getUser(a.user.id);
  if (u) {
    u.photo = String(Date.now()); // cache-buster only; the bytes are served by /api/files/avatar/<id>
    await saveUser(u);
  }
  await audit("photo.updated", a.user.id);
  return json({ ok: true, v: u?.photo });
}

export async function DELETE() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  await removeObject(`avatar/${a.user.id}`);
  const u = await getUser(a.user.id);
  if (u) {
    u.photo = undefined;
    await saveUser(u);
  }
  return json({ ok: true });
}
