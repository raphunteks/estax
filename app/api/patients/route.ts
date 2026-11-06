import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { createUser, findByEmail } from "@/lib/auth/users";
import { randomToken } from "@/lib/auth/crypto";
import { sendInvite } from "@/lib/auth/invite";
import { createPatient, findDuplicate, getPatient, searchPatients, summary } from "@/lib/clinic/patients";
import { staffPatientSchema } from "@/lib/patient-schema";

export async function GET(req: Request) {
  const a = await requirePerm("patients:read");
  if (isResponse(a)) return a;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length > 60) return fail("validation");
  return json({ ok: true, patients: (await searchPatients(q)).map(summary) });
}

export async function POST(req: Request) {
  const a = await requirePerm("patients:create");
  if (isResponse(a)) return a;
  const p = staffPatientSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  if (!(await rateLimit("patient-create", a.user.id, 60, 3600))) return fail("rate_limited", 429);
  const v = p.data;
  const dup = await findDuplicate(v);
  if (dup && !v.force) {
    const d = await getPatient(dup);
    return json({ ok: false, code: "duplicate", message: "Pasien serupa sudah terdaftar.", existing: d ? summary(d) : null }, 409);
  }
  const pat = await createPatient(v, { createdBy: a.user.id, verified: true });
  let invited: boolean | null = null;
  if (v.email && !(await findByEmail(v.email))) {
    const u = await createUser({ email: v.email, name: v.name, role: "pasien", password: randomToken() + "aA1", createdBy: a.user.id, mustChangePassword: true });
    pat.userId = u.id;
    const { savePatient } = await import("@/lib/clinic/patients");
    await savePatient(pat);
    const { db } = await import("@/lib/db/store");
    await db().set(`patient:byuser:${u.id}`, pat.id);
    invited = await sendInvite(u);
  }
  await audit("patient.created", a.user.id, { patient: pat.id, rm: pat.rmNo });
  return json({ ok: true, patient: summary(pat), invited }, 201);
}
