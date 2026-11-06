import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { saveSurvey, surveyDone, surveySchema } from "@/lib/clinic/engage";
import { ownsPatient, ownIds } from "@/lib/clinic/family";
import { getVisit, visitsOfPatient } from "@/lib/clinic/visits";

const guard = async () => {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  return a.user.role === "pasien" ? a : fail("forbidden", 403);
};
/** Finished visits that still wait for a survey. */
export async function GET() {
  const a = await guard();
  if (isResponse(a)) return a;
  const vs = (await Promise.all((await ownIds(a.user.id)).map(visitsOfPatient))).flat().filter((v) => v.status === "selesai");
  const pending = [];
  for (const v of vs.sort((x, y) => y.date.localeCompare(x.date)).slice(0, 10)) if (!(await surveyDone(v.id))) pending.push({ visitId: v.id, date: v.date });
  return json({ ok: true, pending });
}
export async function POST(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const p = surveySchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Beri nilai 1 sampai 5.");
  if (!(await rateLimit("survey", a.user.id, 20, 3600))) return fail("rate_limited", 429);
  const v = await getVisit(p.data.visitId);
  if (!v || v.status !== "selesai" || !(await ownsPatient(a.user.id, v.patientId))) return fail("not_found", 404);
  if (!(await saveSurvey({ visitId: v.id, patientId: v.patientId, doctorId: v.doctorId, rating: p.data.rating, comment: p.data.comment }))) return fail("state", 409, "Survei untuk kunjungan ini sudah diisi.");
  await audit("survey.submitted", a.user.id, { visit: v.id });
  return json({ ok: true }, 201);
}
