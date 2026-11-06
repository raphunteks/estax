import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { consentsOfVisit, requestConsent } from "@/lib/clinic/care";
import { getVisit } from "@/lib/clinic/visits";

const strip = ({ signature: _s, ip: _i, ...c }: Awaited<ReturnType<typeof consentsOfVisit>>[number]) => ({ ...c, signed: Boolean(_s) });

export async function GET(req: Request) {
  const a = await requirePerm("exam:read-basic");
  if (isResponse(a)) return a;
  const id = new URL(req.url).searchParams.get("visitId") ?? "";
  const v = await getVisit(id);
  if (!v || (a.user.role === "dokter" && v.doctorId !== a.user.id)) return fail("not_found", 404);
  return json({ ok: true, consents: (await consentsOfVisit(id)).map(strip) });
}
export async function POST(req: Request) {
  const a = await requirePerm("exam:*");
  if (isResponse(a)) return a;
  const p = z.object({ visitId: z.string().min(6).max(60), tplId: z.string().max(30) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("consent-req", a.user.id, 60, 3600))) return fail("rate_limited", 429);
  const v = await getVisit(p.data.visitId);
  if (!v || (a.user.role === "dokter" && v.doctorId !== a.user.id)) return fail("not_found", 404);
  const c = await requestConsent(v, p.data.tplId, a.user.name);
  if (!c) return fail("template", 400, "Template tidak tersedia.");
  await audit("consent.requested", a.user.id, { consent: c.id, visit: v.id });
  return json({ ok: true, id: c.id }, 201);
}
