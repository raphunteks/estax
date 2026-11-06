import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { due, listInvoices, paid, total } from "@/lib/clinic/billing";
import { ownIds } from "@/lib/clinic/family";

/** The patient's own invoices (read only). */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const ids = await ownIds(a.user.id);
  const list = (await Promise.all(ids.map((id) => listInvoices({ patientId: id })))).flat().filter((i) => i.status !== "batal").sort((x, y) => y.createdAt - x.createdAt);
  return json({ ok: true, invoices: list.map((i) => ({ id: i.id, promo: i.promoName ?? null, no: i.no, date: i.date, items: i.items, discount: i.discount, total: total(i), paid: paid(i), due: due(i), status: i.status, payments: i.payments.map((x) => ({ at: x.at, amount: x.amount, method: x.method })) })) });
}
