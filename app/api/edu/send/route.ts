import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { sendEdu } from "@/lib/clinic/care";
import { getVisit } from "@/lib/clinic/visits";
import { getMaster } from "@/lib/master";

export async function POST(req: Request) {
  const a = await requirePerm("exam:read-basic");
  if (isResponse(a)) return a;
  const p = z.object({ visitId: z.string().min(6).max(60), eduId: z.string().max(30) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const v = await getVisit(p.data.visitId);
  if (!v || (a.user.role === "dokter" && v.doctorId !== a.user.id)) return fail("not_found", 404);
  const art = (await getMaster("edu")).find((x) => x.id === p.data.eduId && x.active);
  if (!art) return fail("not_found", 404, "Materi tidak tersedia.");
  const sent = await sendEdu(v.patientId, v.id, art);
  await audit("edu.sent", a.user.id, { visit: v.id, edu: art.id });
  return json({ ok: true, sent, message: sent ? "Terkirim ke pasien." : "Materi ini sudah pernah dikirim untuk kunjungan ini." });
}
