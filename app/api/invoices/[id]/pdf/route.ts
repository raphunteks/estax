import { fail, isResponse, requireAuth } from "@/lib/api";
import { can } from "@/lib/auth/rbac";
import { getUser } from "@/lib/auth/users";
import { due, getInvoice, paid, total } from "@/lib/clinic/billing";
import { ownsPatient } from "@/lib/clinic/family";
import { getPatient } from "@/lib/clinic/patients";
import { pdf } from "@/lib/pdf";

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
/** Receipt (kuitansi) for the owning patient or billing staff. Only paid amounts are shown as received. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const inv = await getInvoice((await ctx.params).id);
  if (!inv) return fail("not_found", 404);
  const ok = a.user.role === "pasien" ? await ownsPatient(a.user.id, inv.patientId) : can(a.user.role, "billing:read");
  if (!ok) return fail("not_found", 404);
  const [pt, doc] = await Promise.all([getPatient(inv.patientId), getUser(inv.doctorId)]);
  const L = 36, R = 384;
  let y = 540;
  const o: Parameters<typeof pdf>[0] = [
    { x: L, y, text: "Estaka Dental Clinic", size: 16, bold: true }, { x: L, y: (y -= 16), text: "KUITANSI PEMBAYARAN", size: 9 },
    { rule: [L, (y -= 10), R, y] },
    { x: L, y: (y -= 18), text: `No: ${inv.no}` }, { x: R, y, text: `Tanggal: ${inv.date}`, right: true },
    { x: L, y: (y -= 14), text: `Pasien: ${pt?.name ?? "-"}${pt?.rmNo ? ` (RM ${pt.rmNo})` : ""}` },
    { x: L, y: (y -= 14), text: `Dokter: ${doc?.name ?? "-"}` },
    { rule: [L, (y -= 10), R, y] },
  ];
  for (const i of inv.items.slice(0, 22)) {
    o.push({ x: L, y: (y -= 15), text: `${i.name.slice(0, 40)}${i.qty > 1 ? ` x${i.qty}` : ""}` }, { x: R, y, text: rp(i.qty * i.price), right: true });
  }
  o.push({ rule: [L, (y -= 8), R, y] });
  if (inv.discount) o.push({ x: L, y: (y -= 15), text: `Diskon${inv.promoName ? ` (${inv.promoName.slice(0, 28)})` : ""}` }, { x: R, y, text: "-" + rp(inv.discount), right: true });
  o.push({ x: L, y: (y -= 16), text: "Total", bold: true }, { x: R, y, text: rp(total(inv)), bold: true, right: true });
  o.push({ x: L, y: (y -= 15), text: "Dibayar" }, { x: R, y, text: rp(paid(inv)), right: true });
  o.push({ x: L, y: (y -= 15), text: "Sisa" }, { x: R, y, text: rp(due(inv)), right: true });
  o.push({ rule: [L, (y -= 10), R, y] }, { x: L, y: (y -= 16), text: `Status: ${inv.status.toUpperCase()}`, bold: true });
  for (const p of inv.payments.slice(0, 6)) o.push({ x: L, y: (y -= 13), text: `${new Date(p.at + 8 * 3600_000).toISOString().slice(0, 10)}  ${p.method}  ${rp(p.amount)}`, size: 8 });
  o.push({ x: L, y: 40, text: "Dokumen ini dibuat otomatis oleh sistem rekam medis klinik.", size: 7 });
  return new Response(new Uint8Array(pdf(o)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="kuitansi-${inv.no.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`, "Cache-Control": "private, no-store" } });
}
