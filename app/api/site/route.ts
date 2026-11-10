import { revalidatePath, revalidateTag } from "next/cache";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getSiteFresh, saveSite } from "@/lib/site";
import { siteSchema } from "@/lib/site-types";

/** Editable landing content. Superadmin only (the wildcard permission; nobody else holds site:manage). */
export async function GET() {
  const a = await requirePerm("site:manage");
  if (isResponse(a)) return a;
  return json({ ok: true, site: await getSiteFresh() });
}

export async function PUT(req: Request) {
  const a = await requirePerm("site:manage");
  if (isResponse(a)) return a;
  const p = siteSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  const url = p.data.clinic.mapsUrl;
  if (url && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)) return fail("validation", 400, "Tautan peta harus dari Google Maps.");
  await saveSite(p.data);
  await audit("site.updated", a.user.id);
  revalidateTag("site-content", { expire: 0 });
  for (const path of ["/", "/dokter", "/layanan", "/teknologi", "/biaya", "/faq", "/lokasi", "/reservasi"]) revalidatePath(path);
  return json({ ok: true });
}
