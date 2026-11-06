import { isResponse, json, requireAuth } from "@/lib/api";
import { doctorsWithSchedule } from "@/lib/clinic/appointments";
import { getMaster } from "@/lib/master";

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const [polis, pays, rules, docs] = await Promise.all([getMaster("poliklinik"), getMaster("paytypes"), getMaster("rules"), doctorsWithSchedule()]);
  return json({
    ok: true,
    poliklinik: polis.filter((p) => p.active),
    paytypes: pays.filter((p) => p.active),
    rules: { horizonDays: rules.horizonDays, cancelHoursBefore: rules.cancelHoursBefore },
    doctors: docs.map((d) => ({ id: d.id, name: d.name, poliklinikId: d.schedule!.poliklinikId ?? null, openDays: Object.entries(d.schedule!.days).filter(([, v]) => v.length).map(([k]) => Number(k)), leave: d.schedule!.leave ?? [] })),
  });
}
