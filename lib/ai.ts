import "server-only";

/** Server-side 9Router client (OpenAI-compatible). The key never reaches the browser. */
const base = process.env.NINEROUTER_BASE_URL?.replace(/\/$/, "");
const key = process.env.NINEROUTER_API_KEY;

export const aiReady = Boolean(base && key);

/** Plain HTTP would expose the key and clinical text. In production it is refused unless AI_ALLOW_INSECURE_HTTP=1 is set on purpose. */
export function aiTransport(): { ok: true } | { ok: false; message: string } {
  if (!base) return { ok: false, message: "AI belum dikonfigurasi." };
  let u: URL;
  try { u = new URL(base); } catch { return { ok: false, message: "NINEROUTER_BASE_URL tidak valid." }; }
  const safe = u.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || process.env.NODE_ENV !== "production" || process.env.AI_ALLOW_INSECURE_HTTP === "1";
  return safe ? { ok: true } : { ok: false, message: "Endpoint AI memakai HTTP biasa. Pasang HTTPS di 9Router (atau set AI_ALLOW_INSECURE_HTTP=1 bila memang menerima risikonya)." };
}

const headers = (json = true): HeadersInit => ({ Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) });
export class AiError extends Error { constructor(public code: string) { super(code); } }

export async function chat(messages: { role: "system" | "user" | "assistant"; content: string }[], o: { max?: number; temperature?: number } = {}) {
  if (!aiReady) throw new AiError("ai_not_configured");
  const tr = aiTransport();
  if (!tr.ok) throw new AiError("insecure_transport");
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: process.env.NINEROUTER_MODEL ?? "estaka-combos",
        messages,
        max_tokens: o.max ?? 900,
        temperature: o.temperature ?? 0.2,
        stream: false,
      }),
    });
  } catch {
    throw new AiError("ai_unreachable");
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[ai] chat -> ${res.status} ${errText.slice(0, 300)}`);
    throw new AiError(`ai_${res.status}`);
  }

  const raw = await res.text().catch(() => "");

  // Handle SSE streaming response if router returns stream
  if (raw.trim().startsWith("data:")) {
    let combinedContent = "";
    let combinedReasoning = "";
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (trimmed.startsWith("data:")) {
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim());
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) combinedContent += delta.content;
          if (delta?.reasoning_content) combinedReasoning += delta.reasoning_content;
        } catch {}
      }
    }
    const result = (combinedContent || combinedReasoning).trim();
    if (result) return result;
  }

  // Handle standard JSON response
  try {
    const data = JSON.parse(raw) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    const m = data.choices?.[0]?.message;
    return (m?.content || m?.reasoning_content || "").trim();
  } catch {
    console.error(`[ai] chat unreadable raw response: ${raw.slice(0, 300)}`);
    throw new AiError("ai_bad_output");
  }
}

let sttCache: { ids: string[]; at: number } | null = null;
/** STT model ids: env override (comma separated), else what the router lists at /models/stt (cached 10 min). */
export async function sttModels(): Promise<string[]> {
  const env = process.env.NINEROUTER_STT_MODEL?.split(",").map((x) => x.trim()).filter(Boolean);
  if (env?.length) return env;
  if (sttCache && Date.now() - sttCache.at < 600_000) return sttCache.ids;
  try {
    const r = await fetch(`${base}/models/stt`, { headers: headers(false), signal: AbortSignal.timeout(10_000) });
    const d = (await r.json()) as { data?: { id?: string }[]; models?: { id?: string }[] };
    const all = (d.data ?? d.models ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));
    const sorted = all.sort((a, b) => {
      const aScore = /whisper|transcribe/i.test(a) ? 1 : 0;
      const bScore = /whisper|transcribe/i.test(b) ? 1 : 0;
      return bScore - aScore;
    });
    const ids = sorted.slice(0, 4);
    if (ids.length) return (sttCache = { ids, at: Date.now() }).ids;
  } catch { /* fall through */ }
  throw new AiError("stt_model_unknown");
}

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "video/webm": "webm", "video/mp4": "mp4" };

/** Speech-to-text. Audio is forwarded and never stored. Tries the listed STT models in order until one answers. */
export async function transcribe(file: Blob, language = "id") {
  if (!aiReady) throw new AiError("ai_not_configured");
  if (!aiTransport().ok) throw new AiError("insecure_transport");
  const ext = EXT[file.type.split(";")[0]] ?? "webm";
  let last = new AiError("stt_model_unknown");
  for (const model of await sttModels()) {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("file", file, `dikte.${ext}`);
    fd.append("language", language);
    let res: Response;
    try { res = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: headers(false), body: fd, signal: AbortSignal.timeout(90_000) }); } catch { throw new AiError("ai_unreachable"); }
    if (res.ok) {
      const d = (await res.json().catch(() => ({}))) as { text?: string };
      const t = (d.text ?? "").trim();
      if (t) return t;
      last = new AiError("stt_empty");
      continue;
    }
    const body = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`[ai] stt ${model} -> ${res.status} ${body}`);
    last = new AiError(`stt_${res.status}`);
    if (res.status === 401 || res.status === 403) break; // credentials problem: other models will fail the same way
  }
  throw last;
}

/** Cheap connectivity probe used by the admin diagnostic: never sends clinical data. */
export async function probe() {
  const out: { step: string; ok: boolean; ms: number; detail: string }[] = [];
  const run = async (step: string, fn: () => Promise<string>) => {
    const t = Date.now();
    try { out.push({ step, ok: true, ms: Date.now() - t, detail: await fn() }); } catch (e) { out.push({ step, ok: false, ms: Date.now() - t, detail: e instanceof AiError ? e.code : e instanceof Error ? e.name : "error" }); }
  };
  await run("chat", async () => { const r = await chat([{ role: "user", content: "Balas satu kata: siap" }], { max: 8 }); if (!r) throw new AiError("empty_reply"); return `model ${process.env.NINEROUTER_MODEL ?? "estaka-combos"}`; });
  await run("stt-models", async () => (await sttModels()).join(", "));
  await run("stt-unggah", async () => {
    // 0.5 s of silence as a WAV: proves the endpoint, model and multipart upload work, without any real audio.
    const n = 8000, buf = Buffer.alloc(44 + n * 2);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(16000, 24); buf.writeUInt32LE(32000, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
    try { await transcribe(new Blob([buf], { type: "audio/wav" })); return "endpoint dikte menjawab"; } catch (e) { if (e instanceof AiError && e.code === "stt_empty") return "endpoint dikte menjawab (hening → teks kosong)"; throw e; }
  });
  return out;
}

/** Text-to-speech. Returns mp3 bytes. */
export async function speak(input: string, model: string) {
  if (!aiReady) throw new AiError("ai_not_configured");
  const res = await fetch(`${base}/audio/speech`, { method: "POST", headers: headers(), body: JSON.stringify({ model, input }), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new AiError(`tts_${res.status}`);
  return res.arrayBuffer();
}
