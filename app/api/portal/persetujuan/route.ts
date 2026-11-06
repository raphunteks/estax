import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { consentsOfPatient } from "@/lib/clinic/care";
import { ownPatients } from "@/lib/clinic/family";
import { getUser } from "@/lib/auth/users";

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const pts = await ownPatients(a.user.id);
  const rows = (await Promise.all(pts.map(async (p) => (await consentsOfPatient(p.id)).map((c) => ({ ...c, patientName: p.name }))))).flat().sort((x, y) => y.createdAt - x.createdAt);
  const names = new Map<string, string>();
  for (const c of rows) if (!names.has(c.doctorId)) names.set(c.doctorId, (await getUser(c.doctorId))?.name ?? "Dokter");
  return json({ ok: true, consents: rows.map((c) => ({ id: c.id, title: c.title, body: c.body, status: c.status, createdAt: c.createdAt, signedAt: c.signedAt, patientName: c.patientName, doctor: names.get(c.doctorId), signature: c.status === "ditandatangani" ? c.signature : undefined })) });
}
