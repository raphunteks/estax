"use client";

import { useEffect, useState } from "react";
import { Card, Empty, Skeleton, api, fmtDate } from "@/components/dash/kit";
import Odontogram from "@/components/dash/Odontogram";
import type { Odo } from "@/lib/clinic/odontogram";

type R = {
  odo: { odo: Odo; lines: string[]; date: string } | null;
  visits: { id: string; date: string; doctor?: string; complaint: string; procedures: { name: string; tooth?: string }[]; plan: { text: string; tooth?: string; status: string }[]; rx: { id: string; drug: string; dose: string; freq: string; days: string }[] }[];
};

/** Patient's own history: finished visits and a read-only odontogram. */
export default function PortalHistory() {
  const [d, setD] = useState<R | null>(() => (api.getCache<R>("/api/portal/riwayat") as unknown as R) ?? null);
  useEffect(() => {
    const t = setTimeout(() => void api<R>("/api/portal/riwayat").then((r) => setD(r.ok ? (r as unknown as R) : { odo: null, visits: [] })), 0);
    return () => clearTimeout(t);
  }, []);
  if (!d) return <Skeleton />;
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">Riwayat perawatan</h1>
      {d.odo && (
        <Card title={`Odontogram terakhir · ${fmtDate(d.odo.date)}`}>
          <Odontogram value={d.odo.odo} readOnly simple />
        </Card>
      )}
      {d.visits.length === 0 ? <Empty>Belum ada kunjungan yang selesai.</Empty> : d.visits.map((v) => (
        <Card key={v.id} title={`${fmtDate(v.date)}${v.doctor ? ` · ${v.doctor}` : ""}`}>
          {v.complaint && <p className="mb-2 text-sm text-muted">Keluhan: {v.complaint}</p>}
          {v.procedures.length > 0 && <><h3 className="text-sm font-semibold">Tindakan</h3><ul className="mb-3 list-disc pl-5 text-sm">{v.procedures.map((p, i) => <li key={i}>{p.name}{p.tooth ? ` (gigi ${p.tooth})` : ""}</li>)}</ul></>}
          {v.plan.length > 0 && <><h3 className="text-sm font-semibold">Rencana perawatan</h3><ul className="mb-3 list-disc pl-5 text-sm">{v.plan.map((p, i) => <li key={i}>{p.text}{p.tooth ? ` (gigi ${p.tooth})` : ""} · {p.status}</li>)}</ul></>}
          {v.rx.length > 0 && <><h3 className="text-sm font-semibold">Resep</h3><ul className="list-disc pl-5 text-sm">{v.rx.map((r) => <li key={r.id}>{r.drug} {r.dose}, {r.freq}{r.days ? `, ${r.days} hari` : ""}</li>)}</ul></>}
        </Card>
      ))}
    </div>
  );
}
