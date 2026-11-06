import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { can } from "@/lib/auth/rbac";
import { listAppts } from "@/lib/clinic/appointments";
import { due, listInvoices } from "@/lib/clinic/billing";
import { chatThreads } from "@/lib/clinic/engage";
import { getPatient } from "@/lib/clinic/patients";
import { listItems, listRx, stock } from "@/lib/clinic/pharmacy";
import { present } from "@/lib/clinic/present";
import { todayWita } from "@/lib/clinic/time";
import { visitOfAppt } from "@/lib/clinic/visits";

type Kpi = { label: string; value: number; href: string; tone: "rose" | "sky" | "amber" | "green" | "violet" | "teal" };

/**
 * Data for the dashboard bottom bar and the role home KPIs. Every query is gated by the same permission
 * the matching page uses, so a role never sees a count (or a patient name) it could not open itself.
 */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const role = a.user.role;
  if (role === "pasien") return fail("forbidden", 403);
  const today = todayWita();
  const badges: Record<string, number> = {};
  const kpis: Kpi[] = [];
  let primary: Record<string, unknown> | null = null;
  let checkin: unknown[] = [];

  const unread = can(role, "chat:staff") ? (await chatThreads()).filter((t) => t.unread).length : 0;
  if (unread) badges["/dashboard/pesan"] = unread;

  if (can(role, "appointments:read")) {
    const mine = role === "dokter" ? a.user.id : undefined;
    const day = (await listAppts({ date: today, doctorId: mine })).filter((x) => !x.status.startsWith("batal"));
    const waiting = day.filter((x) => x.status === "checkin");
    const done = day.filter((x) => x.status === "selesai").length;
    const arrivedSoon = day.filter((x) => x.status === "dikonfirmasi" || x.status === "menunggu");
    if (role === "dokter") {
      badges["/dashboard/janji"] = waiting.length;
      const cur = day.filter((x) => x.status === "dipanggil" || x.status === "dikursi")[0] ?? [...waiting].sort((x, y) => (x.queueNo ?? 0) - (y.queueNo ?? 0))[0];
      if (cur) {
        const [pa] = await present([cur]);
        primary = { kind: "exam", apptId: cur.id, patientName: pa.patientName, queueNo: cur.queueNo ?? null, status: cur.status, visitId: (await visitOfAppt(cur.id)) ?? null };
      }
      kpis.push({ label: "Pasien hari ini", value: day.length, href: "/dashboard/janji?tab=queue", tone: "sky" }, { label: "Menunggu", value: waiting.length, href: "/dashboard/janji?tab=queue", tone: "amber" }, { label: "Selesai", value: done, href: "/dashboard/janji?tab=queue", tone: "green" }, { label: "Pesan baru", value: unread, href: "/dashboard/pesan", tone: "rose" });
    } else {
      const pending = (await listAppts({ status: ["menunggu"] })).filter((x) => x.date >= today).length;
      badges["/dashboard/janji"] = pending;
      if (role === "staf" || role === "superadmin") {
        checkin = (await present(arrivedSoon.sort((x, y) => x.time.localeCompare(y.time)).slice(0, 30))).map((r) => ({ id: r.id, time: r.time, patientName: r.patientName, rmNo: r.rmNo ?? null, doctorName: r.doctorName, status: r.status }));
      }
      kpis.push({ label: "Janji hari ini", value: day.length, href: "/dashboard/janji?tab=queue", tone: "sky" }, { label: "Perlu konfirmasi", value: pending, href: "/dashboard/janji?tab=req", tone: "amber" }, { label: "Sudah tiba", value: waiting.length, href: "/dashboard/janji?tab=queue", tone: "green" });
    }
  }
  if (can(role, "billing:read") && role !== "dokter") {
    const unpaid = (await listInvoices({ limit: 300 })).filter((i) => i.status !== "batal" && due(i) > 0).length;
    badges["/dashboard/kasir"] = unpaid;
    if (role !== "apoteker") kpis.push({ label: "Tagihan belum lunas", value: unpaid, href: "/dashboard/kasir", tone: "violet" });
  }
  if (role === "staf" || role === "superadmin") kpis.push({ label: "Pesan baru", value: unread, href: "/dashboard/pesan", tone: "rose" });
  if (role === "apoteker" && can(role, "pharmacy:*")) {
    const waiting = (await listRx("menunggu")).sort((x, y) => x.createdAt - y.createdAt);
    const low = (await listItems()).filter((i) => i.active && stock(i) < i.min).length;
    badges["/dashboard/farmasi?tab=rx"] = waiting.length;
    badges["/dashboard/farmasi?tab=stock"] = low;
    if (waiting[0]) primary = { kind: "rx", visitId: waiting[0].visitId, patientName: (await getPatient(waiting[0].patientId))?.name ?? "Pasien", called: Boolean(waiting[0].calledAt) };
    kpis.push({ label: "Resep menunggu", value: waiting.length, href: "/dashboard/farmasi?tab=rx", tone: "amber" }, { label: "Sudah dipanggil", value: waiting.filter((r) => r.calledAt).length, href: "/dashboard/farmasi?tab=rx", tone: "green" }, { label: "Stok menipis", value: low, href: "/dashboard/farmasi?tab=stock", tone: "rose" });
  }
  return json({ ok: true, role, badges, kpis, primary, checkin });
}
