import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { describe } from "@/lib/clinic/odontogram";
import { patientOfUser } from "@/lib/clinic/patients";
import { visitsOfPatient } from "@/lib/clinic/visits";
import { getUser } from "@/lib/auth/users";

/** Patient's own finished visits: procedures, plan, prescriptions and a read-only odontogram. No SOAP notes. */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = await patientOfUser(a.user.id);
  if (!p) return json({ ok: true, visits: [], odo: null });
  const vs = (await visitsOfPatient(p.id)).filter((v) => v.status === "selesai");
  const names = new Map<string, string>();
  for (const v of vs) if (!names.has(v.doctorId)) names.set(v.doctorId, (await getUser(v.doctorId))?.name ?? "Dokter");
  return json({
    ok: true,
    odo: vs[0] ? { odo: vs[0].odo, lines: describe(vs[0].odo), date: vs[0].date } : null,
    visits: vs.map((v) => ({ id: v.id, date: v.date, doctor: names.get(v.doctorId), complaint: v.anamnesis.complaint ?? "", procedures: v.procedures.map((x) => ({ name: x.name, tooth: x.tooth })), plan: v.plan.map((x) => ({ text: x.text, tooth: x.tooth, status: x.status })), rx: v.rx })),
  });
}
