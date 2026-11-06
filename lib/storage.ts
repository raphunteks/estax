import "server-only";
import { del, get, put } from "@vercel/blob";
import { db } from "@/lib/db/store";

/** Private object storage. Vercel Blob in production; in dev without a token the bytes live in the dev store. */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveObject(key: string, bytes: Buffer, contentType: string) {
  if (blobEnabled()) {
    await put(key, bytes, { access: "private", contentType, allowOverwrite: true, addRandomSuffix: false });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("BLOB_READ_WRITE_TOKEN is required in production");
  await db().set(`obj:${key}`, { type: contentType, b64: bytes.toString("base64") });
}

export async function readObject(key: string): Promise<{ body: BodyInit; type: string } | null> {
  if (blobEnabled()) {
    const r = await get(key, { access: "private" }).catch(() => null);
    return r && r.statusCode === 200 ? { body: r.stream, type: r.blob.contentType } : null;
  }
  const o = await db().get<{ type: string; b64: string }>(`obj:${key}`);
  return o ? { body: new Uint8Array(Buffer.from(o.b64, "base64")), type: o.type } : null;
}

export async function removeObject(key: string) {
  if (blobEnabled()) await del(key).catch(() => null);
  else await db().del(`obj:${key}`);
}
