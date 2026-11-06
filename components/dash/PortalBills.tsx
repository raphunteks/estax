"use client";

import { useEffect, useState } from "react";
import { Card, Empty, Skeleton, api, fmtDate } from "./kit";
import { InvBadge, rp } from "./Billing";

type B = { id: string; no: string; date: string; items: { id: string; name: string; qty: number; price: number }[]; discount: number; total: number; paid: number; due: number; status: string; payments: { at: number; amount: number; method: string }[] };
export default function PortalBills() {
  const [rows, setRows] = useState<B[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => void api<{ invoices: B[] }>("/api/portal/tagihan").then((r) => setRows(r.ok ? r.invoices : [])), 0);
    return () => clearTimeout(t);
  }, []);
  if (!rows) return <Skeleton />;
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">Tagihan</h1>
      {!rows.length ? <Empty>Belum ada tagihan.</Empty> : rows.map((b) => (
        <Card key={b.id} title={`${b.no} · ${fmtDate(b.date)}`} right={<InvBadge s={b.status} />}>
          <ul className="space-y-1 text-sm">{b.items.map((x) => <li key={x.id} className="flex justify-between gap-3"><span>{x.name} ×{x.qty}</span><span>{rp(x.qty * x.price)}</span></li>)}</ul>
          <p className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-medium"><span>Total {b.discount ? `(diskon ${rp(b.discount)})` : ""}</span><span>{rp(b.total)}</span></p>
          <p className="flex justify-between text-sm text-muted"><span>Dibayar</span><span>{rp(b.paid)}</span></p>
          {b.due > 0 && <p className="flex justify-between text-sm font-medium"><span>Sisa</span><span>{rp(b.due)}</span></p>}
          {b.due > 0 && <p className="mt-2 text-xs text-muted">Pembayaran dilakukan di kasir klinik.</p>}
        </Card>
      ))}
    </div>
  );
}
