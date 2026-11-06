import "server-only";
import { del, get, put } from "@vercel/blob";
import { db } from "@/lib/db/store";

/** Private object storage. Uses Vercel Blob if configured; falls back safely to DB store (Upstash Redis). */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

export async function saveObject(key: string, bytes: Buffer, contentType: string) {
  if (blobEnabled()) {
    try {
      await put(key, bytes, { access: "private", contentType, allowOverwrite: true, addRandomSuffix: false });
      return;
    } catch (err) {
      console.warn("[storage] Vercel Blob put failed, falling back to db:", err);
    }
  }
  await db().set(`obj:${key}`, { type: contentType, b64: bytes.toString("base64") });
}

export async function readObject(key: string): Promise<{ body: BodyInit; type: string } | null> {
  if (blobEnabled()) {
    try {
      const r = await get(key, { access: "private" }).catch(() => null);
      if (r && r.statusCode === 200) {
        return { body: r.stream, type: r.blob.contentType };
      }
    } catch (err) {
      console.warn("[storage] Vercel Blob get failed, trying fallback:", err);
    }
  }
  const o = await db().get<{ type: string; b64: string }>(`obj:${key}`);
  return o ? { body: new Uint8Array(Buffer.from(o.b64, "base64")), type: o.type } : null;
}

export async function removeObject(key: string) {
  if (blobEnabled()) {
    try {
      await del(key).catch(() => null);
    } catch {
      /* ignore */
    }
  }
  await db().del(`obj:${key}`);
}
