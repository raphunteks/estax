import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { importIcd } from "@/lib/clinic/icd10";

/** Superadmin: replace the stored list with the WHO plain-text table (icd102019syst_codes.txt). */
export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "superadmin") return fail("forbidden", 403);
  const f = (await req.formData().catch(() => null))?.get("file");
  if (!(f instanceof Blob) || f.size < 1000 || f.size > 8 * 1024 * 1024) return fail("validation", 400, "Berkas harus berupa teks daftar kode WHO (maksimal 8 MB).");
  const r = await importIcd(await f.text());
  if (!r.ok) return fail("validation", 400, `Hanya ${r.count} kode terbaca. Pakai berkas icd102019syst_codes.txt dari paket "icd102019enMeta.zip".`);
  await audit("icd.import", a.user.id, { count: r.count });
  return json({ ok: true, count: r.count });
}
