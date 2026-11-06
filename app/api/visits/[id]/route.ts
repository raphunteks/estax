import { z } from "zod";
import { invoiceFromVisit } from "@/lib/clinic/billing";
import { queueRx } from "@/lib/clinic/pharmacy";
import { autoEdu, indexRecall, recallDate } from "@/lib/clinic/care";
import { pushPatient } from "@/lib/clinic/appointments";
import { getMaster } from "@/lib/master";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { act, getAppt, isErr } from "@/lib/clinic/appointments";
import { getPatient, summary } from "@/lib/clinic/patients";
import { odoSchema } from "@/lib/clinic/odontogram";
import { icdTitle } from "@/lib/clinic/icd10";
import { anamnesisSchema, dxSchema, getVisit, logOdo, odoLog, planSchema, procSchema, rxSchema, saveVisit, soapSchema, vitalsSchema } from "@/lib/clinic/visits";

type Ctx = { params: Promise<{ id: string }> };

/** Staff see the basic part only (anamnesis + vitals). Superadmin must give a reason, which is audited. */
export async function GET(req: Request, ctx: Ctx) {
  const a = await requirePerm("exam:read-basic");
  if (isResponse(a)) return a;
  const v = await getVisit((await ctx.params).id);
  if (!v) return fail("not_found", 404);
  const role = a.user.role;
  if (role === "superadmin") {
    const reason = new URL(req.url).searchParams.get("reason")?.trim() ?? "";
    if (reason.length < 5) return fail("reason_required", 400, "Alasan akses wajib diisi.");
    await audit("visit.viewed.reason", a.user.id, { visit: v.id, reason: reason.slice(0, 200) });
  } else await audit("visit.viewed", a.user.id, { visit: v.id });
  const p = await getPatient(v.patientId);
  const head = { id: v.id, status: v.status, date: v.date, doctorId: v.doctorId, apptId: v.apptId, patient: p ? { ...summary(p), birthDate: p.birthDate, gender: p.gender, health: p.health } : null };
  const owner = role === "dokter" && v.doctorId === a.user.id;
  if (role === "staf") return json({ ok: true, level: "basic", visit: { ...head, anamnesis: v.anamnesis, vitals: v.vitals } });
  const previous = (await (await import("@/lib/clinic/visits")).visitsOfPatient(v.patientId)).filter((x) => x.id !== v.id && x.status === "selesai" && x.createdAt < v.createdAt)[0];
  return json({ ok: true, level: "full", owner, visit: { ...head, anamnesis: v.anamnesis, vitals: v.vitals, soap: v.soap, diagnoses: v.diagnoses ?? [], plan: v.plan, procedures: v.procedures, rx: v.rx, odo: v.odo, recall: v.recall ?? null }, previousOdo: previous?.odo ?? null, previousDate: previous?.date ?? null, history: owner ? (await odoLog(v.id)).length : 0 });
}

const patch = z.object({
  anamnesis: anamnesisSchema.optional(), vitals: vitalsSchema.optional(), soap: soapSchema.optional(), diagnoses: dxSchema.optional(),
  plan: planSchema.optional(), procedures: procSchema.optional(), rx: rxSchema.optional(), odo: odoSchema.optional(),
  finish: z.literal(true).optional(),
  recall: z.object({ name: z.string().trim().min(2).max(60), days: z.number().int().min(1).max(730), note: z.string().trim().max(200).optional() }).nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await requirePerm("exam:read-basic");
  if (isResponse(a)) return a;
  const p = patch.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const v = await getVisit((await ctx.params).id);
  if (!v) return fail("not_found", 404);
  const d = p.data;
  const isDoctor = a.user.role === "dokter" && v.doctorId === a.user.id;
  const basicOnly = d.recall === undefined && !d.soap && !d.diagnoses && !d.plan && !d.procedures && !d.rx && !d.odo && !d.finish;
  // Doctors write everything on their own visits; staff only anamnesis/vitals; nobody else writes.
  if (!(isDoctor || (a.user.role === "staf" && basicOnly))) {
    await audit("access.denied", a.user.id, { perm: "exam:write", visit: v.id });
    return fail("forbidden", 403);
  }
  if (v.status === "selesai") return fail("locked", 409, "Kunjungan sudah selesai.");
  if (d.anamnesis) v.anamnesis = { ...v.anamnesis, ...d.anamnesis };
  if (d.vitals) v.vitals = { ...v.vitals, ...d.vitals };
  if (d.soap) v.soap = { ...v.soap, ...d.soap };
  if (d.diagnoses) {
    const out = [];
    for (const x of d.diagnoses) {
      const hit = await icdTitle(x.code);
      if (!hit) return fail("validation", 400, `Kode ICD-10 ${x.code} tidak dikenal.`);
      out.push({ code: hit[0], title: hit[1], primary: x.primary || undefined });
    }
    v.diagnoses = out;
  }
  if (d.plan) v.plan = d.plan;
  if (d.procedures) v.procedures = d.procedures;
  if (d.rx) v.rx = d.rx;
  if (d.odo) {
    v.odo = d.odo;
    await logOdo(v, a.user.id);
  }
  if (d.recall !== undefined && (isDoctor || a.user.role === "superadmin")) {
    v.recall = d.recall ? { name: d.recall.name, date: recallDate(v.date, d.recall.days), note: d.recall.note } : undefined;
    if (d.recall) await indexRecall(v.id);
  }
  if (d.finish) {
    v.status = "selesai";
    v.finishedAt = Date.now();
    const appt = await getAppt(v.apptId);
    // Close the appointment even if nobody pressed "call" or "seat" along the way.
    let cur = appt;
    for (const step of ["call", "seat", "done"] as const) {
      const need = { call: "checkin", seat: "dipanggil", done: "dikursi" }[step];
      if (!cur || cur.status !== need) continue;
      const r = await act(cur, step, { id: a.user.id, role: a.user.role }, {});
      cur = isErr(r) ? null : r;
    }
    await saveVisit(v); // hand-off below reads the finished visit from the store
    // Billing + pharmacy hand-off: best-effort, never blocks closing the visit.
    await invoiceFromVisit(v.id).catch(() => null);
    await queueRx(v.id).catch(() => null);
    await autoEdu(v).catch(() => null);
    if ((await getMaster("features")).surveyEnabled) await pushPatient(v.patientId, "Bagaimana kunjungan Anda?", "Beri penilaian singkat untuk membantu kami melayani lebih baik.", "/portal/survei").catch(() => null);
    await audit("visit.finished", a.user.id, { visit: v.id, patient: v.patientId });
  }
  await saveVisit(v);
  return json({ ok: true, status: v.status });
}
