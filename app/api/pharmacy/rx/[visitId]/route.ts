import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { dispense, dispenseSchema, getRx } from "@/lib/clinic/pharmacy";
import { getPatient } from "@/lib/clinic/patients";

export async function GET(_: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const a = await requirePerm("pharmacy:dispense");
  if (isResponse(a)) return a;
  const rx = await getRx((await params).visitId);
  if (!rx) return fail("not_found", 404);
  const p = await getPatient(rx.patientId);
  return json({ ok: true, rx, patient: { name: p?.name ?? "-", rmNo: p?.rmNo ?? null } });
}
export async function POST(req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const a = await requirePerm("pharmacy:dispense");
  if (isResponse(a)) return a;
  const p = dispenseSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const id = (await params).visitId;
  const r = await dispense(id, p.data, a.user.id);
  if (!r.ok) return json({ ok: false, code: r.code, message: r.message, warnings: r.warnings }, r.status);
  await audit("pharmacy.dispensed", a.user.id, { visit: id });
  return json({ ok: true });
}
