import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { getConsent, saveConsent } from "@/lib/clinic/care";
import { ownsPatient } from "@/lib/clinic/family";
import { getPatient } from "@/lib/clinic/patients";
import { notifyUser } from "@/lib/push";
import { clientIp } from "@/lib/redis";

const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sign"), signature: z.string().max(120_000).regex(PNG), signerName: z.string().trim().min(2).max(80), agree: z.literal(true) }),
  z.object({ action: z.literal("decline") }),
]);

/** The patient (or guardian) signs on screen. A signed consent is immutable. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Tanda tangan dan persetujuan wajib diisi.");
  if (!(await rateLimit("consent-sign", a.user.id, 30, 3600))) return fail("rate_limited", 429);
  const c = await getConsent((await ctx.params).id);
  if (!c || !(await ownsPatient(a.user.id, c.patientId))) return fail("not_found", 404);
  if (c.status !== "menunggu") return fail("state", 409, "Persetujuan ini sudah diproses.");
  if (p.data.action === "sign") Object.assign(c, { status: "ditandatangani", signature: p.data.signature, signerName: p.data.signerName, signedAt: Date.now(), ip: clientIp(req) });
  else Object.assign(c, { status: "ditolak", signedAt: Date.now(), ip: clientIp(req) });
  await saveConsent(c);
  const pat = await getPatient(c.patientId);
  await notifyUser(c.doctorId, { title: p.data.action === "sign" ? "Persetujuan ditandatangani" : "Persetujuan ditolak", body: `${pat?.name ?? "Pasien"}: ${c.title}`, url: `/dashboard/periksa/${c.visitId}` });
  await audit(p.data.action === "sign" ? "consent.signed" : "consent.declined", a.user.id, { consent: c.id, visit: c.visitId });
  return json({ ok: true });
}
