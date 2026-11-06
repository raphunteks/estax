import { createHash, timingSafeEqual } from "node:crypto";
import { toWaDigits, type BookingRecord } from "@/lib/booking";
import { treatments } from "@/lib/content";
import { BOOKINGS_KEY, bookingKey, clientIp, getLimiter, getRedis, hasRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const sha = (s: string) => createHash("sha256").update(s).digest();

function authorized(request: Request): boolean {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const okUser = timingSafeEqual(sha(decoded.slice(0, i)), sha(user));
  const okPass = timingSafeEqual(sha(decoded.slice(i + 1)), sha(pass));
  return okUser && okPass;
}

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const challenge = () =>
  new Response("Authentication required", {
    status: 401,
    headers: { ...headers, "WWW-Authenticate": 'Basic realm="Estaka Admin", charset="UTF-8"' },
  });

async function gate(request: Request): Promise<Response | null> {
  if (!hasRedis() || !process.env.ADMIN_PASSWORD) {
    return new Response("Admin belum dikonfigurasi (Upstash + ADMIN_PASSWORD).", { status: 503, headers });
  }
  const { success } = await getLimiter("admin", 30, "10 m").limit(clientIp(request));
  if (!success) return new Response("Too many requests", { status: 429, headers });
  return authorized(request) ? null : challenge();
}

export async function GET(request: Request) {
  const blocked = await gate(request);
  if (blocked) return blocked;

  const redis = getRedis();
  const ids = (await redis.zrange<string[]>(BOOKINGS_KEY, 0, -1, { rev: true })) ?? [];
  const rows = ids.length ? await redis.mget<(BookingRecord | null)[]>(...ids.map(bookingKey)) : [];
  const label = (id: string) => treatments.find((t) => t.id === id)?.label.id ?? id;

  const body = rows
    .filter((r): r is BookingRecord => Boolean(r))
    .map(
      (r) => `<tr>
<td>${esc(r.createdAt.slice(0, 16).replace("T", " "))}</td>
<td>${esc(r.name)}</td>
<td>${esc(label(r.treatment))}</td>
<td>${esc(r.date)} ${esc(r.time)}</td>
<td>${esc(r.note) || "-"}</td>
<td><a href="https://wa.me/${esc(toWaDigits(r.phone))}" rel="noopener noreferrer" target="_blank">${esc(r.phone)}</a></td>
<td><form method="post"><input type="hidden" name="id" value="${esc(r.id)}"><button type="submit">Hapus</button></form></td>
</tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin - Estaka</title>
<style>body{font:14px/1.5 system-ui;margin:24px;background:#0b0f10;color:#eef2f0}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #2a3335;padding:8px 10px;text-align:left;vertical-align:top}th{color:#8fa09c;font-weight:600}a{color:#46d9c6}button{background:#2a3335;color:#eef2f0;border:0;padding:6px 12px;border-radius:6px;cursor:pointer}button:hover{background:#7a2e2e}.wrap{overflow-x:auto}</style></head>
<body><h1>Janji temu (${rows.filter(Boolean).length})</h1><p>Data berisi informasi pribadi pasien. Hapus bila sudah tidak diperlukan.</p>
<div class="wrap"><table><thead><tr><th>Masuk</th><th>Nama</th><th>Perawatan</th><th>Jadwal</th><th>Catatan</th><th>WhatsApp</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="7">Belum ada janji.</td></tr>'}</tbody></table></div></body></html>`;

  return new Response(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  const blocked = await gate(request);
  if (blocked) return blocked;

  // CSRF guard: Basic auth credentials are sent automatically by browsers.
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return new Response("Forbidden", { status: 403, headers });

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (!UUID_RE.test(id)) return new Response("Bad request", { status: 400, headers });

  const redis = getRedis();
  await redis.del(bookingKey(id));
  await redis.zrem(BOOKINGS_KEY, id);
  return new Response(null, { status: 303, headers: { ...headers, Location: "/admin" } });
}
