import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { addDependent, dependentSchema, ownPatients, removeDependent } from "@/lib/clinic/family";

const guard = async () => {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  return a.user.role === "pasien" ? a : fail("forbidden", 403);
};
export async function GET() {
  const a = await guard();
  if (isResponse(a)) return a;
  const list = await ownPatients(a.user.id);
  return json({ ok: true, members: list.map((p, i) => ({ id: p.id, name: p.name, relation: i === 0 && !p.guardianUserId ? "saya" : p.relation, rmNo: p.rmNo ?? null, birthDate: p.birthDate, self: i === 0 && !p.guardianUserId })) });
}
export async function POST(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const p = dependentSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  const d = await addDependent(a.user.id, p.data);
  if (!d) return fail("limit", 409, "Tidak dapat menambah anggota keluarga (data pasien belum ada atau batas 8 tercapai).");
  await audit("family.added", a.user.id, { patient: d.id });
  return json({ ok: true, id: d.id }, 201);
}
export async function DELETE(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!(await removeDependent(a.user.id, id))) return fail("not_found", 404);
  await audit("family.removed", a.user.id, { patient: id });
  return json({ ok: true });
}
