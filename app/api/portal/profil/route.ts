import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { patientOfUser } from "@/lib/clinic/patients";

/** The patient's own registration data. The ID number stays masked; the encrypted value never leaves the server. */
export async function GET() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = await patientOfUser(a.user.id);
  if (!p) return json({ ok: true, patient: null });
  return json({
    ok: true,
    patient: {
      name: p.name, rmNo: p.rmNo ?? null, status: p.status, gender: p.gender, birthDate: p.birthDate, birthPlace: p.birthPlace,
      idType: p.idType, idMasked: p.idMasked, phone: p.phone, email: p.email ?? a.user.email, address: p.address, health: p.health, emergency: p.emergency,
    },
  });
}
