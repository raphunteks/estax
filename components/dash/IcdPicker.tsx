"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "./kit";

export type Dx = { code: string; title: string; primary?: boolean };
type Item = { code: string; en: string; id: string };

/** ICD-10 diagnosis picker: type-ahead dropdown (code, English or Indonesian words) backed by the list in the database. */
export default function IcdPicker({ value, readOnly, onChange }: { value: Dx[]; readOnly: boolean; onChange: (v: Dx[]) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await api<{ items: Item[] }>(`/api/icd?q=${encodeURIComponent(q)}`);
      if (n === seq.current) { setItems(r.ok ? r.items : []); setHi(0); setBusy(false); }
    }, q ? 150 : 0);
    return () => clearTimeout(t);
  }, [q, open]);

  const pick = (it: Item) => {
    if (!value.some((x) => x.code === it.code)) onChange([...value, { code: it.code, title: it.en, primary: value.length === 0 || undefined }]);
    setQ(""); setOpen(false);
  };
  const setPrimary = (code: string) => onChange(value.map((x) => ({ ...x, primary: x.code === code || undefined })));
  const remove = (code: string) => {
    const next = value.filter((x) => x.code !== code);
    if (next.length && !next.some((x) => x.primary)) next[0] = { ...next[0], primary: true };
    onChange(next);
  };

  return (
    <div>
      {!readOnly && (
        <div className="relative">
          <label htmlFor={`icd-${uid}`} className="mb-1 block text-sm font-medium">Cari diagnosis (kode atau nama)</label>
          <input
            id={`icd-${uid}`} name="icd10-search" role="combobox" aria-expanded={open} aria-controls={`icd-list-${uid}`} aria-autocomplete="list" autoComplete="off"
            aria-activedescendant={open && items[hi] ? `icd-o-${uid}-${hi}` : undefined}
            className="min-h-11 w-full rounded-xl border border-line bg-transparent px-3 text-sm outline-none focus-visible:border-accent"
            placeholder="Contoh: K02.1, karies dentin, pulpitis" value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              else if (e.key === "Enter" && open && items[hi]) { e.preventDefault(); pick(items[hi]); }
              else if (e.key === "Escape") setOpen(false);
            }}
          />
          {open && (
            <ul id={`icd-list-${uid}`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
              {busy && !items.length && <li className="px-3 py-2 text-sm text-muted">Mencari…</li>}
              {!busy && !items.length && <li className="px-3 py-2 text-sm text-muted">Tidak ada kode yang cocok.</li>}
              {items.map((it, i) => (
                <li key={it.code} id={`icd-o-${uid}-${i}`} role="option" aria-selected={i === hi} onMouseDown={(e) => (e.preventDefault(), pick(it))} onMouseEnter={() => setHi(i)}
                  className={`flex cursor-pointer gap-3 rounded-lg px-3 py-2 text-sm ${i === hi ? "bg-accent/15" : ""}`}>
                  <span className="w-14 shrink-0 font-semibold tabular-nums">{it.code}</span>
                  <span className="min-w-0"><span className="block">{it.id || it.en}</span>{it.id && <span className="block text-xs text-muted">{it.en}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {value.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Belum ada diagnosis.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {value.map((d) => (
            <li key={d.code} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span className="font-semibold tabular-nums">{d.code}</span>
              <span className="min-w-0 flex-1">{d.title}</span>
              {d.primary ? <span className="rounded-full border border-accent/40 px-2 py-0.5 text-xs text-accent">Utama</span> : !readOnly && <button type="button" className="rounded-full border border-line px-2 py-0.5 text-xs" onClick={() => setPrimary(d.code)}>Jadikan utama</button>}
              {!readOnly && <button type="button" aria-label={`Hapus ${d.code}`} className="grid size-8 place-items-center rounded-lg text-muted hover:text-fg" onClick={() => remove(d.code)}>✕</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
