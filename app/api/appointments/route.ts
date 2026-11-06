import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { ACTIVE, createAppt, isErr, listAppts, type Status } from "@/lib/clinic/appointments";
import { getPatient, patientOfUser } from "@/lib/clinic/patients";
import { present } from "@/lib/clinic/present";

const body = z.object({
  patientId: z.string().optional(),
  doctorId: z.string().min(6).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  payTypeId: z.string().min(2).max(30),
  payNumber: z.string().max(40).optional(),
  complaint: z.string().max(300).optional(),
});

export async function GET(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!can(a.user.role, "appointments:read")) {
    await audit("access.denied", a.user.id, { perm: "appointments:read" });
    return fail("forbidden", 403);
  }
  const u = new URL(req.url).searchParams;
  const date = u.get("date") ?? undefined;
  const status = u.get("status")?.split(",") as Status[] | undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("validation");
  const doctorId = a.user.role === "dokter" ? a.user.id : (u.get("doctor") ?? undefined); // a doctor only ever sees their own list
  const from = u.get("from") ?? undefined, to = u.get("to") ?? undefined;
  if ([from, to].some((x) => x && !/^\d{4}-\d{2}-\d{2}$/.test(x))) return fail("validation");
  const rows = status?.includes("menunggu") && !date ? await listAppts({ status, doctorId }) : await listAppts({ date: date ?? undefined, from, to, doctorId, status });
  return json({ ok: true, appointments: await present(rows), active: ACTIVE });
}

export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const isPatient = a.user.role === "pasien";
  if (!can(a.user.role, isPatient ? "appointments:own" : "appointments:create")) {
    await audit("access.denied", a.user.id, { perm: "appointments:create" });
    return fail("forbidden", 403);
  }
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("appt-create", a.user.id, 20, 3600))) return fail("rate_limited", 429);
  const patient = isPatient ? await patientOfUser(a.user.id) : p.data.patientId ? await getPatient(p.data.patientId) : null;
  if (!patient) return fail("patient", 400, isPatient ? "Data pasien tidak ditemukan." : "Pilih pasien.");
  const r = await createAppt({ ...p.data, patientId: patient.id }, { id: a.user.id, role: a.user.role });
  if (isErr(r)) return fail(r.error, r.status, r.message);
  await audit("appt.created", a.user.id, { appt: r.id });
  return json({ ok: true, appointment: (await present([r]))[0] }, 201);
}
