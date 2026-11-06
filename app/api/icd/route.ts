import { isResponse, json, requirePerm } from "@/lib/api";
import { icdMeta, searchIcd } from "@/lib/clinic/icd10";

/** Type-ahead search over the ICD-10 list stored in the database (code prefix, English or Indonesian words). */
export async function GET(req: Request) {
  const a = await requirePerm("exam:read-basic");
  if (isResponse(a)) return a;
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  const rows = await searchIcd(q);
  return json({ ok: true, items: rows.map(([code, en, id]) => ({ code, en, id: id ?? "" })), meta: q ? undefined : await icdMeta() });
}
export const dynamic = "force-dynamic";
