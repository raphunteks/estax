/** Clinic time is Asia/Makassar (UTC+8, no DST). Dates are "YYYY-MM-DD", times "HH:MM". */
export const epoch = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`).getTime();
export const todayWita = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
export const weekday = (date: string) => new Date(`${date}T12:00:00+08:00`).getUTCDay();
export const addDays = (date: string, n: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10);
export const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
