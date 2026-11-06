"use client";

import { useCallback, useRef, useState } from "react";
import { MOTION_OK, gsap } from "@/lib/gsap";
import {
  CODES, CODE_KEYS, PERMANENT, PRIMARY, SURFACES, SURFACE_LABEL, TONE, ALL_TEETH, describe, diff,
  type Code, type Odo, type Surface,
} from "@/lib/clinic/odontogram";
import { Badge, Select } from "@/components/dash/kit";

const fillOf = (c?: Code) => (c ? `color-mix(in srgb, var(--${TONE[c] ?? "info"}) ${TONE[c] === "muted" ? 0 : 70}%, var(--surface))` : "var(--surface)");
// Areas of one tooth in a 40x40 box: top=b, right=d/m, bottom=l, left, center=o. Anterior teeth use the same layout.
const AREAS: { s: Surface; d: string }[] = [
  { s: "b", d: "M0 0H40L30 10H10Z" },
  { s: "d", d: "M40 0V40L30 30V10Z" },
  { s: "l", d: "M40 40H0L10 30H30Z" },
  { s: "m", d: "M0 40V0L10 10V30Z" },
  { s: "o", d: "M10 10H30V30H10Z" },
];

type Tool = Code | "erase";

function Tooth({ id, t, changed, onArea, readOnly }: { id: string; t: Odo["teeth"][string] | undefined; changed: boolean; onArea: (tooth: string, s: Surface) => void; readOnly: boolean }) {
  const w = t?.w;
  return (
    <g data-tooth={id}>
      <text x="20" y="-5" textAnchor="middle" className="fill-current text-[10px] font-semibold">{id}</text>
      <g opacity={w === "NON" || w === "MIS" ? 0.35 : 1}>
        {AREAS.map(({ s, d }) => (
          <path
            key={s}
            d={d}
            data-area={s}
            fill={fillOf(t?.s?.[s] ?? (w && w !== "NON" && w !== "MIS" ? w : undefined))}
            stroke="var(--fg)"
            strokeOpacity="0.45"
            strokeWidth="0.8"
            role={readOnly ? undefined : "button"}
            tabIndex={!readOnly && s === "o" ? 0 : undefined}
            aria-label={readOnly ? undefined : `Gigi ${id}, ${SURFACE_LABEL[s]}`}
            onClick={() => !readOnly && onArea(id, s)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), !readOnly && onArea(id, s))}
            className={readOnly ? "" : "cursor-pointer outline-none hover:opacity-80 focus-visible:stroke-[2]"}
          >
            <title>{`${id} · ${SURFACE_LABEL[s]}${t?.s?.[s] ? " · " + CODES[t.s[s]!].id : ""}`}</title>
          </path>
        ))}
      </g>
      {(w === "NON" || w === "MIS" || w === "RRX") && <path d="M4 4L36 36M36 4L4 36" stroke="var(--fg)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />}
      {changed && <rect x="-3" y="-3" width="46" height="46" rx="8" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />}
      <text x="20" y="56" textAnchor="middle" className="fill-current text-[9px]">{w ?? ""}</text>
    </g>
  );
}

/** Interactive FDI odontogram: palette, surface clicks, undo/redo, compare with the previous visit, auto result text. */
export default function Odontogram({ value, onChange, previous, readOnly = false, simple = false }: { value: Odo; onChange?: (o: Odo) => void; previous?: Odo | null; readOnly?: boolean; simple?: boolean }) {
  const [tool, setTool] = useState<Tool>("CAR");
  const [primary, setPrimary] = useState(false);
  const [cmp, setCmp] = useState(false);
  const [undo, setUndo] = useState<Odo[]>([]);
  const [redo, setRedo] = useState<Odo[]>([]);
  const [form, setForm] = useState({ tooth: "16", surface: "o" as Surface });
  const root = useRef<SVGSVGElement>(null);

  const commit = useCallback(
    (next: Odo) => {
      setUndo((u) => [...u.slice(-39), value]);
      setRedo([]);
      onChange?.(next);
    },
    [value, onChange],
  );
  const pop = (tooth: string) => {
    if (!window.matchMedia(MOTION_OK).matches) return;
    const el = root.current?.querySelector(`[data-tooth="${tooth}"]`);
    if (el) gsap.fromTo(el, { scale: 0.94, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, ease: "back.out(2)", clearProps: "transform" });
  };
  const apply = (tooth: string, s: Surface) => {
    if (!ALL_TEETH.has(tooth)) return;
    const teeth = { ...value.teeth };
    const cur = { ...(teeth[tooth] ?? {}) };
    if (tool === "erase") {
      if (cur.s?.[s]) {
        const ss = { ...cur.s };
        delete ss[s];
        cur.s = ss;
      } else delete cur.w;
    } else if (CODES[tool].whole) cur.w = tool;
    else cur.s = { ...(cur.s ?? {}), [s]: tool };
    if (!cur.w && !Object.keys(cur.s ?? {}).length) delete teeth[tooth];
    else teeth[tooth] = cur;
    commit({ teeth });
    pop(tooth);
  };
  const doUndo = () => {
    const prev = undo[undo.length - 1];
    if (!prev) return;
    setUndo(undo.slice(0, -1));
    setRedo([...redo, value]);
    onChange?.(prev);
  };
  const doRedo = () => {
    const next = redo[redo.length - 1];
    if (!next) return;
    setRedo(redo.slice(0, -1));
    setUndo([...undo, value]);
    onChange?.(next);
  };

  const rows = primary ? PRIMARY : PERMANENT;
  const changed = new Set(cmp && previous ? diff(previous, value) : []);
  const cell = 52;
  const rowW = (q: string[]) => q.length * cell;
  const lines = describe(value);
  const groups = [...new Set(CODE_KEYS.map((c) => CODES[c].group))];

  return (
    <div>
      {!readOnly && !simple && (
        <div className="mb-4 space-y-3">
          {groups.map((g) => (
            <div key={g} role="group" aria-label={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 text-xs text-muted">{g}</span>
              {CODE_KEYS.filter((c) => CODES[c].group === g).map((c) => (
                <button key={c} type="button" aria-pressed={tool === c} title={CODES[c].id} onClick={() => setTool(c)} className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition-[background-color,transform] active:scale-95 ${tool === c ? "border-accent bg-accent text-accent-ink" : "border-line hover:bg-card"}`}>
                  {c}
                </button>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={tool === "erase"} onClick={() => setTool("erase")} className={`min-h-9 rounded-lg border px-3 text-xs ${tool === "erase" ? "border-accent bg-accent text-accent-ink" : "border-line hover:bg-card"}`}>Hapus</button>
            <button type="button" onClick={doUndo} disabled={!undo.length} className="min-h-9 rounded-lg border border-line px-3 text-xs hover:bg-card disabled:opacity-40">Urungkan</button>
            <button type="button" onClick={doRedo} disabled={!redo.length} className="min-h-9 rounded-lg border border-line px-3 text-xs hover:bg-card disabled:opacity-40">Ulangi</button>
            <p className="text-xs text-muted" aria-live="polite">Alat: <strong className="text-fg">{tool === "erase" ? "Hapus" : `${tool} · ${CODES[tool].id}`}</strong></p>
          </div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={primary} onClick={() => setPrimary((p) => !p)} className="min-h-9 rounded-lg border border-line px-3 text-xs hover:bg-card aria-pressed:border-accent">{primary ? "Gigi susu" : "Gigi dewasa"} (ganti)</button>
        {previous && !simple && <button type="button" aria-pressed={cmp} onClick={() => setCmp((c) => !c)} className="min-h-9 rounded-lg border border-line px-3 text-xs hover:bg-card aria-pressed:border-accent">Bandingkan dengan kunjungan lalu</button>}
        {cmp && <Badge tone="warn">{changed.size} gigi berubah</Badge>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card p-3" tabIndex={0} role="region" aria-label="Odontogram, geser untuk melihat semua gigi">
        <svg ref={root} viewBox={`-10 -14 ${rowW(rows[0]) * 2 + 40} 165`} className="h-auto min-w-[640px] w-full text-fg" role="group" aria-label="Odontogram">
          {[0, 2].map((r, ri) => (
            <g key={r} transform={`translate(0 ${ri * 80})`}>
              {[rows[r], rows[r + 1]].map((q, qi) => (
                <g key={qi} transform={`translate(${qi * (rowW(rows[0]) + 20)} 0)`}>
                  {q.map((tid, i) => (
                    <g key={tid} transform={`translate(${i * cell} 0)`}>
                      <Tooth id={tid} t={value.teeth[tid]} changed={changed.has(tid)} onArea={apply} readOnly={readOnly} />
                    </g>
                  ))}
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      {!readOnly && !simple && (
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), apply(form.tooth, form.surface))} aria-label="Terapkan tanpa klik gambar">
          <label className="text-xs text-muted">Gigi
            <Select value={form.tooth} onChange={(e) => setForm({ ...form, tooth: e.target.value })}>{[...ALL_TEETH].map((t) => <option key={t}>{t}</option>)}</Select>
          </label>
          <label className="text-xs text-muted">Permukaan
            <Select value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value as Surface })}>{SURFACES.map((s) => <option key={s} value={s}>{SURFACE_LABEL[s]}</option>)}</Select>
          </label>
          <button className="btn btn-ghost min-h-10" type="submit">Terapkan alat</button>
        </form>
      )}

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold">Hasil pemeriksaan</h3>
        {lines.length ? <ul className="space-y-1 text-sm text-muted">{lines.map((l) => <li key={l}>{l}</li>)}</ul> : <p className="text-sm text-muted">Belum ada temuan.</p>}
      </div>
    </div>
  );
}
