import sharp from "sharp";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { randomId } from "@/lib/auth/crypto";
import { ownIds, ownsPatient } from "@/lib/clinic/family";
import { db } from "@/lib/db/store";
import { removeObject, saveObject } from "@/lib/storage";

const MAX = 6 * 1024 * 1024;
const MAGIC = [[0xff, 0xd8, 0xff], [0x89, 0x50, 0x4e, 0x47], [0x52, 0x49, 0x46, 0x46]];
export type PFile = { id: string; patientId: string; label: string; kind: "rontgen" | "foto" | "lain"; t: number; by: string };
export const pfList = async (pid: string) => ((await Promise.all((await db().smembers(`pf:${pid}`)).map((id) => db().get<PFile>(`pfm:${id}`)))).filter(Boolean) as PFile[]).sort((a, b) => b.t - a.t);

const guard = async () => {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  return a.user.role === "pasien" ? a : fail("forbidden", 403);
};
export async function GET() {
  const a = await guard();
  if (isResponse(a)) return a;
  return json({ ok: true, files: (await Promise.all((await ownIds(a.user.id)).map(pfList))).flat() });
}
/** Previous photos / x-rays from the patient. Magic bytes are checked, then re-encoded to WebP (drops EXIF/GPS). */
export async function POST(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  if (!(await rateLimit("pfile", a.user.id, 15, 3600))) return fail("rate_limited", 429);
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  const patientId = String(fd?.get("patientId") ?? "");
  const kind = (["rontgen", "foto", "lain"].includes(String(fd?.get("kind"))) ? String(fd?.get("kind")) : "lain") as PFile["kind"];
  const label = String(fd?.get("label") ?? "").trim().slice(0, 80) || (kind === "rontgen" ? "Foto rontgen" : "Foto gigi");
  if (!(f instanceof File) || !(await ownsPatient(a.user.id, patientId))) return fail("validation", 400, "Pilih berkas gambar dan anggota keluarga.");
  if (f.size > MAX) return fail("too_large", 413, "Maksimal 6 MB.");
  if ((await db().smembers(`pf:${patientId}`)).length >= 30) return fail("limit", 409, "Maksimal 30 berkas.");
  const buf = Buffer.from(await f.arrayBuffer());
  if (!MAGIC.some((m) => m.every((b, i) => buf[i] === b))) return fail("bad_type", 415, "Gunakan JPG, PNG, atau WebP.");
  let out: Buffer;
  try {
    out = await sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    return fail("bad_type", 415, "Gambar tidak dapat dibaca.");
  }
  const id = randomId().slice(0, 12);
  await saveObject(`pf/${id}`, out, "image/webp");
  await db().set(`pfm:${id}`, { id, patientId, label, kind, t: Date.now(), by: a.user.id } satisfies PFile);
  await db().sadd(`pf:${patientId}`, id);
  await audit("pfile.uploaded", a.user.id, { patient: patientId, file: id });
  return json({ ok: true, id }, 201);
}
export async function DELETE(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const m = await db().get<PFile>(`pfm:${id}`);
  if (!m || !(await ownsPatient(a.user.id, m.patientId))) return fail("not_found", 404);
  await removeObject(`pf/${id}`);
  await db().del(`pfm:${id}`);
  await db().srem(`pf:${m.patientId}`, id);
  return json({ ok: true });
}
