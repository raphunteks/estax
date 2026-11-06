import crypto from "node:crypto";

/**
 * WhatsApp delivery through a Hermes Agent webhook route (direct delivery, no LLM).
 * Hermes side (config.yaml): routes.<name> { secret, deliver: "whatsapp", deliver_only: true, prompt: "{text}", deliver_extra: { chat_id: "{chat_id}" } }
 * Signature: "Generic V2" = HMAC-SHA256 hex of `<unix-ts>.<raw body>`, headers X-Webhook-Timestamp + X-Webhook-Signature-V2.
 */
export const hermesConfigured = () => Boolean(process.env.HERMES_WEBHOOK_URL && process.env.HERMES_WEBHOOK_SECRET);

function target(): URL | null {
  try {
    const u = new URL(process.env.HERMES_WEBHOOK_URL ?? "");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (process.env.NODE_ENV === "production" && u.protocol !== "https:" && !loopback) return null; // patient data must not travel over plain HTTP
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export async function sendWhatsApp(phone: string, text: string, id: string): Promise<{ ok: boolean; reason?: string }> {
  const url = target();
  const secret = process.env.HERMES_WEBHOOK_SECRET;
  if (!url || !secret) return { ok: false, reason: "not_configured" };
  const suffix = process.env.HERMES_WA_CHAT_SUFFIX ?? "@s.whatsapp.net";
  const body = JSON.stringify({ event_type: "reminder", id, phone, chat_id: `${phone}${suffix}`, text });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Webhook-Timestamp": ts, "X-Webhook-Signature-V2": sig, "X-Request-ID": id }, body, signal: AbortSignal.timeout(10_000), redirect: "error" });
    return r.ok ? { ok: true } : { ok: false, reason: `http_${r.status}` };
  } catch {
    return { ok: false, reason: "network" };
  }
}
