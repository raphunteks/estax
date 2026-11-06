import sharp from "sharp";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { getUser, saveUser } from "@/lib/auth/users";
import { removeObject, saveObject } from "@/lib/storage";

const MAX = 10 * 1024 * 1024; // 10 MB

function isSvg(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 1024)).toString("utf8").toLowerCase();
  return head.includes("<svg") || (head.includes("<?xml") && head.includes("<svg"));
}

function isHeicOrHeif(buf: Buffer, fileName = "", mimeType = ""): boolean {
  if (/\.(heic|heif|avif)$/i.test(fileName) || /image\/(heic|heif|avif)/i.test(mimeType)) return true;
  if (buf.length >= 12) {
    const ftyp = buf.subarray(4, 8).toString("ascii");
    if (ftyp === "ftyp") {
      const brand = buf.subarray(8, 12).toString("ascii").toLowerCase();
      if (["heic", "heix", "hevc", "mif1", "msf1", "avif", "isom"].some((b) => brand.includes(b))) return true;
    }
  }
  return false;
}

function isRecognizedImage(buf: Buffer, fileName = "", mimeType = ""): boolean {
  if (buf.length < 4) return false;
  // JPEG: 0xFF, 0xD8, 0xFF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 0x89, 0x50, 0x4E, 0x47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // BMP: BM
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  // TIFF: II or MM
  if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4d && buf[1] === 0x4d)) return true;
  // SVG
  if (isSvg(buf)) return true;
  // HEIC / HEIF / AVIF
  if (isHeicOrHeif(buf, fileName, mimeType)) return true;
  return false;
}

async function convertToAvatarWebp(buf: Buffer, isHeic: boolean): Promise<Buffer> {
  if (isHeic) {
    // 1. Try sharp native decode
    try {
      return await sharp(buf).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    } catch {
      // 2. Fallback to heic-decode for iPhone iOS HEVC HEIC images
      try {
        const decodeModule = await import("heic-decode");
        const decode = (decodeModule.default || decodeModule) as unknown as (arg: { buffer: Uint8Array }) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>;
        const { data, width, height } = await decode({ buffer: buf });
        return await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
          .rotate()
          .resize(512, 512, { fit: "cover" })
          .webp({ quality: 82 })
          .toBuffer();
      } catch (err) {
        console.error("[convertToAvatarWebp] HEIC decode failed:", err);
        throw new Error("Format HEIC tidak dapat didekode.");
      }
    }
  }

  // Standard sharp pipeline for JPEG, PNG, WebP, SVG, GIF, BMP, TIFF
  return await sharp(buf).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
}

/** Profile photo for every role. Supported: PNG, JPG, JPEG, WebP, HEIC/HEIF, SVG, GIF, BMP, TIFF. Re-encoded to 512px WebP (strips EXIF & GPS). */
export async function POST(req: Request) {
  try {
    const a = await requireAuth({ allowLocked: true });
    if (isResponse(a)) return a;
    if (!(await rateLimit("photo", a.user.id, 20, 3600))) return fail("rate_limited", 429, "Terlalu banyak unggahan foto. Tunggu beberapa saat.");

    const formData = await req.formData().catch(() => null);
    const f = formData?.get("file");
    if (!(f instanceof File)) return fail("validation", 400, "Pilih berkas gambar.");
    if (f.size > MAX) return fail("too_large", 413, "Ukuran gambar maksimal 10 MB.");

    const buf = Buffer.from(await f.arrayBuffer());
    const heic = isHeicOrHeif(buf, f.name, f.type);
    if (!isRecognizedImage(buf, f.name, f.type)) {
      return fail("bad_type", 415, "Format gambar tidak didukung. Gunakan PNG, JPG, JPEG, HEIC, WebP, atau SVG.");
    }

    let out: Buffer;
    try {
      out = await convertToAvatarWebp(buf, heic);
    } catch (err) {
      console.error("[api/me/photo] Sharp conversion failed:", err);
      return fail("bad_type", 415, "Berkas gambar rusak atau tidak dapat dibaca.");
    }

    const key = `avatar/${a.user.id}`;
    await saveObject(key, out, "image/webp");
    const u = await getUser(a.user.id);
    if (u) {
      u.photo = String(Date.now()); // cache-buster only; bytes served by /api/files/avatar/<id>
      await saveUser(u);
    }
    await audit("photo.updated", a.user.id);
    return json({ ok: true, v: u?.photo });
  } catch (err) {
    console.error("[api/me/photo] POST error:", err);
    return fail("server_error", 500, "Gagal memproses unggahan foto profil.");
  }
}

export async function DELETE() {
  try {
    const a = await requireAuth({ allowLocked: true });
    if (isResponse(a)) return a;
    await removeObject(`avatar/${a.user.id}`);
    const u = await getUser(a.user.id);
    if (u) {
      u.photo = undefined;
      await saveUser(u);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("[api/me/photo] DELETE error:", err);
    return fail("server_error", 500, "Gagal menghapus foto profil.");
  }
}
