/** Clinic schedule helpers shared by client (UI) and server (validation). TODO: confirm with the owner. */
export const TZ = "Asia/Makassar";

export const SCHEDULE = {
  /** 0 = Sunday ... 6 = Saturday */
  openDays: [1, 2, 3, 4, 5, 6],
  slots: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
  horizonDays: 14,
} as const;

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function isOpenDay(iso: string): boolean {
  return (SCHEDULE.openDays as readonly number[]).includes(dayOfWeek(iso));
}

export function isBookable(date: string, time: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(SCHEDULE.slots as readonly string[]).includes(time)) return false;
  const today = todayISO(now);
  const last = addDays(today, SCHEDULE.horizonDays);
  if (date < today || date > last || !isOpenDay(date)) return false;
  if (date === today) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m > nowMinutes(now) + 30;
  }
  return true;
}

export function bookableDays(now: Date = new Date()): string[] {
  const today = todayISO(now);
  const out: string[] = [];
  for (let i = 0; i <= SCHEDULE.horizonDays; i++) {
    const d = addDays(today, i);
    if (isOpenDay(d)) out.push(d);
  }
  return out;
}
