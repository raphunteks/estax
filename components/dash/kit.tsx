"use client";

import { useId, useState } from "react";
import { inputCls } from "@/components/auth/ui";

export type ApiRes<T = unknown> = { ok: boolean; code?: string; message?: string } & T;

type CacheItem<T = unknown> = { at: number; p: Promise<ApiRes<T>>; data?: ApiRes<T> };
const hot = new Map<string, CacheItem>();
// Long TTL: 5 minutes (300,000ms). Realtime invalidation via "estaka:rev" (Pusher / SSE) clears this instantly when any data changes.
const TTL = 300_000;

// A live-sync change means any reused GET may be outdated: drop it so widgets refetch real data.
if (typeof window !== "undefined") {
  window.addEventListener("estaka:rev", () => hot.clear());
}
const NO_CACHE = /^\/api\/(visits\/|ai|auth|admin)/;

export interface ApiFunction {
  <T = unknown>(url: string, method?: string, body?: unknown): Promise<ApiRes<T>>;
  getCache<T = unknown>(url: string): ApiRes<T> | undefined;
  prefetch(url: string): void;
  clearCache(): void;
}

const apiImpl = async function <T = unknown>(url: string, method = "GET", body?: unknown): Promise<ApiRes<T>> {
  const get = method === "GET" && !NO_CACHE.test(url);
  if (get) {
    const h = hot.get(url);
    if (h && Date.now() - h.at < TTL) {
      if (h.data) return h.data as ApiRes<T>;
      return h.p as Promise<ApiRes<T>>;
    }
  } else if (method !== "GET") {
    hot.clear();
  }

  const p = (async () => {
    try {
      const r = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const res = (await r.json()) as ApiRes<T>;
      if (get && res && (res as { ok?: boolean }).ok) {
        const item = hot.get(url);
        if (item) item.data = res;
      }
      // Own write: ask LiveSync to check the revision right now instead of waiting for its next tick.
      if (method !== "GET" && res.ok) window.dispatchEvent(new Event("estaka:poke"));
      return res;
    } catch {
      return { ok: false, code: "network", message: "Koneksi bermasalah." } as ApiRes<T>;
    }
  })();

  if (get) {
    hot.set(url, { at: Date.now(), p });
    void p.then((r) => {
      if (!r.ok) hot.delete(url);
    });
  }
  return p;
};

apiImpl.getCache = <T = unknown>(url: string): ApiRes<T> | undefined => {
  const h = hot.get(url);
  if (h && Date.now() - h.at < TTL && h.data && h.data.ok) {
    return h.data as ApiRes<T>;
  }
  return undefined;
};

apiImpl.prefetch = (url: string) => {
  if (!NO_CACHE.test(url) && !apiImpl.getCache(url)) {
    void apiImpl(url);
  }
};

apiImpl.clearCache = () => {
  hot.clear();
};

export const api: ApiFunction = apiImpl as unknown as ApiFunction;

export const Card = ({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <section className="glass rounded-2xl p-5 sm:p-6">
    {(title || right) && (
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && <h2 className="display text-xl">{title}</h2>}
        {right}
      </div>
    )}
    {children}
  </section>
);

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line p-1">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)} className={`min-h-10 shrink-0 rounded-lg px-4 text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${value === id ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}
/** Every control gets a stable id and a name (browser autofill/DevTools audit); callers can still pass their own. */
function useFieldAttrs(p: { id?: string; name?: string; placeholder?: string; "aria-label"?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hint = (p["aria-label"] ?? p.placeholder ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  return { id: p.id ?? `f-${uid}`, name: p.name ?? (hint || `field-${uid}`) };
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} {...useFieldAttrs(p)} className={`${inputCls} ${p.className ?? ""}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} {...useFieldAttrs(p)} className={`${inputCls} ${p.className ?? ""}`} />;

export const Badge = ({ children, tone = "muted" }: { children: React.ReactNode; tone?: "ok" | "warn" | "muted" | "bad" }) => (
  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${{ ok: "border-accent/40 text-accent", warn: "border-amber-400/40 text-amber-300", bad: "border-red-400/40 text-red-300", muted: "border-line text-muted" }[tone]}`}>{children}</span>
);

/** Two-step button: first click asks, second confirms. Replaces browser confirm() dialogs. */
export function ConfirmBtn({ label, onConfirm, danger }: { label: string; onConfirm: () => void; danger?: boolean }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="inline-flex gap-1">
      <button className={`rounded-lg px-2.5 py-1.5 text-xs ${danger ? "bg-red-500/20 text-red-300" : "bg-accent/20 text-accent"}`} onClick={() => (setAsk(false), onConfirm())}>
        Yakin?
      </button>
      <button className="rounded-lg px-2 py-1.5 text-xs text-muted" onClick={() => setAsk(false)}>
        Batal
      </button>
    </span>
  ) : (
    <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-[transform,color] hover:text-fg active:scale-[0.97]" onClick={() => setAsk(true)}>
      {label}
    </button>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</p>;
export const Skeleton = () => <div className="h-24 animate-pulse rounded-2xl bg-fg/5" aria-label="Memuat" />;

export const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "muted" | "bad" }> = {
  menunggu: { label: "Menunggu konfirmasi", tone: "warn" }, dikonfirmasi: { label: "Dikonfirmasi", tone: "ok" }, checkin: { label: "Di ruang tunggu", tone: "warn" },
  dipanggil: { label: "Dipanggil", tone: "ok" }, dikursi: { label: "Di kursi", tone: "ok" }, selesai: { label: "Selesai", tone: "muted" },
  batal_pasien: { label: "Dibatalkan pasien", tone: "bad" }, batal_klinik: { label: "Dibatalkan klinik", tone: "bad" }, tidak_hadir: { label: "Tidak hadir", tone: "bad" },
};
export const StatusBadge = ({ s }: { s: string }) => <Badge tone={STATUS[s]?.tone}>{STATUS[s]?.label ?? s}</Badge>;
export const fmtDate = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Makassar" });
export const witaToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
export const addD = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
