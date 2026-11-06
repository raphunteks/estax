import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { due, listInvoices, paid, total } from "@/lib/clinic/billing";
import { patientOfUser } from "@/lib/clinic/patients";

/** The patient's own invoices (read only). */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = await patientOfUser(a.user.id);
  if (!p) return json({ ok: true, invoices: [] });
  const list = (await listInvoices({ patientId: p.id })).filter((i) => i.status !== "batal");
  return json({ ok: true, invoices: list.map((i) => ({ id: i.id, no: i.no, date: i.date, items: i.items, discount: i.discount, total: total(i), paid: paid(i), due: due(i), status: i.status, payments: i.payments.map((x) => ({ at: x.at, amount: x.amount, method: x.method })) })) });
}
