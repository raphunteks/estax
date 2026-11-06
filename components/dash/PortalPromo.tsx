"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, Skeleton, api, fmtDate } from "./kit";

type P = { id: string; name: string; desc: string; kind: string; value: number; end: string; code: string | null; tariffs: string[] };
const label = (p: P) => (p.kind === "percent" ? `${p.value}%` : p.kind === "amount" ? `Rp ${p.value.toLocaleString("id-ID")}` : "Gratis");

export default function PortalPromo() {
  const [rows, setRows] = useState<P[] | null>(null);
  useEffect(() => void api<{ promos: P[] }>("/api/portal/promo").then((r) => setRows(r.ok ? r.promos : [])), []);
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Promo</h1>
      {!rows ? <Skeleton /> : rows.length === 0 ? <Empty>Belum ada promo yang berlaku untuk Anda saat ini.</Empty> : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted">Sampai {fmtDate(p.end)}</p></div><p className="display text-3xl text-accent">{label(p)}</p></div>
              {p.desc && <p className="mt-2 text-sm text-muted">{p.desc}</p>}
              {p.tariffs.length > 0 && <p className="mt-1 text-xs text-muted">Berlaku untuk: {p.tariffs.join(", ")}</p>}
              {p.code && <p className="mt-1 text-xs">Kode: <strong>{p.code}</strong></p>}
              <Link href="/portal/janji" className="btn btn-primary mt-3 inline-flex">Buat janji dengan promo</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
