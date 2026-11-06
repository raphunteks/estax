import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getAppt, listAppts } from "@/lib/clinic/appointments";
import { getPatient } from "@/lib/clinic/patients";
import { todayWita } from "@/lib/clinic/time";
import { getVisit, startVisit, visitOfAppt, visitsOfPatient } from "@/lib/clinic/visits";

/** Visit list for one patient (metadata only, no clinical text). */
export async function GET(req: Request) {
  const a = await requirePerm("exam:read-basic");
  if (isResponse(a)) return a;
  const q = new URL(req.url).searchParams;
  if (q.get("mine") === "1") {
    // Running visits today for the AI "apply to visit" picker: a doctor sees their own, superadmin sees everyone's, others none.
    if (a.user.role !== "dokter" && a.user.role !== "superadmin") return json({ ok: true, visits: [] });
    const live = await listAppts({ date: todayWita(), ...(a.user.role === "dokter" ? { doctorId: a.user.id } : {}), status: ["checkin", "dipanggil", "dikursi"] });
    const out = [];
    for (const ap of live) {
      const id = await visitOfAppt(ap.id);
      const v = id ? await getVisit(id) : null;
      if (v && v.status === "berjalan") out.push({ id: v.id, patientId: v.patientId, patientName: (await getPatient(v.patientId))?.name ?? "-", time: ap.time });
    }
    return json({ ok: true, visits: out });
  }
  const pid = q.get("patientId") ?? "";
  if (!pid) return fail("validation");
  const vs = await visitsOfPatient(pid);
  return json({ ok: true, visits: vs.map((v) => ({ id: v.id, date: v.date, status: v.status, doctorId: v.doctorId, complaint: v.anamnesis.complaint ?? "" })) });
}

/** Start (or resume) the visit of an appointment. Only the appointment's own doctor. */
export async function POST(req: Request) {
  const a = await requirePerm("exam:read-basic"); // staff start the visit for anamnesis and vitals; doctors for the full record
  if (isResponse(a)) return a;
  const p = z.object({ apptId: z.string().max(40) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const appt = await getAppt(p.data.apptId);
  if (!appt || !(a.user.role === "staf" || (a.user.role === "dokter" && appt.doctorId === a.user.id))) return fail("forbidden", 403);
  if (!["checkin", "dipanggil", "dikursi", "selesai"].includes(appt.status)) return fail("not_ready", 409, "Pasien belum check-in.");
  const v = await startVisit(appt);
  await audit("visit.started", a.user.id, { visit: v.id, patient: v.patientId });
  return json({ ok: true, id: v.id });
}
