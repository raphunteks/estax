import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { due, invoiceFromVisit, listInvoices, paid, total, type Invoice } from "@/lib/clinic/billing";
import { getPatient } from "@/lib/clinic/patients";
import { currentRev, db } from "@/lib/db/store";

export async function present(list: Invoice[]) {
  const cache = new Map<string, { name: string; rmNo: string | null }>();
  const out = [];
  for (const i of list) {
    if (!cache.has(i.patientId)) { const p = await getPatient(i.patientId); cache.set(i.patientId, { name: p?.name ?? "-", rmNo: p?.rmNo ?? null }); }
    out.push({ ...i, patientName: cache.get(i.patientId)!.name, rmNo: cache.get(i.patientId)!.rmNo, total: total(i), paid: paid(i), due: due(i) });
  }
  return out;
}

export async function GET(req: Request) {
  const a = await requirePerm("billing:read");
  if (isResponse(a)) return a;
  const u = new URL(req.url).searchParams;
  const st = u.get("status") ?? "all";
  const pid = u.get("patientId") ?? "all";

  const rev = await currentRev();
  const cacheKey = `cache:invoices:${st}:${pid}:${rev}`;
  try {
    const cached = await db().get<unknown[]>(cacheKey);
    if (cached) return json({ ok: true, invoices: cached, fromCache: true });
  } catch {
    /* fallback */
  }

  const invoices = await present(await listInvoices({ status: u.get("status") ?? undefined, patientId: u.get("patientId") ?? undefined }));
  try {
    await db().set(cacheKey, invoices, { ex: 3600 });
  } catch {
    /* ignore */
  }
  return json({ ok: true, invoices });
}

/** Create (or return) the invoice of a finished visit; normally this already happened when the doctor finished it. */
export async function POST(req: Request) {
  const a = await requirePerm("billing:write");
  if (isResponse(a)) return a;
  const p = z.object({ visitId: z.string().max(40) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const inv = await invoiceFromVisit(p.data.visitId);
  if (!inv) return fail("not_ready", 409, "Kunjungan belum selesai.");
  await audit("invoice.created", a.user.id, { invoice: inv.id });
  return json({ ok: true, id: inv.id });
}
