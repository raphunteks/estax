"use client";

import { useCallback, useEffect, useState } from "react";
import { LIVE_EVENT, peek, remember } from "@/lib/live";
import Link from "next/link";
import { ApptActions, type A } from "./Appointments";
import { VisitHistory } from "./Exam";
import { Badge, Card, Empty, Input, Skeleton, StatusBadge, api, fmtDate } from "./kit";

type P = { id: string; name: string; rmNo: string | null; status: string; phone: string; gender: string; birthDate: string; idMasked: string; hasAccount: boolean; duplicate: boolean };

export function PatientList({ canCreate }: { canCreate: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<P[] | null>(() => peek<P[]>("patients:"));
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    const d = await api<{ patients: P[] }>(`/api/patients?q=${encodeURIComponent(q)}`);
    if (d.ok) (remember(`patients:${q}`, d.patients), setRows(d.patients), setErr(false));
    else setErr(true);
  }, [q]);
  // Typing waits 250 ms; mount and live changes load at once. An empty search shows the cached list immediately.
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    const on = () => void load();
    window.addEventListener(LIVE_EVENT, on);
    return () => window.removeEventListener(LIVE_EVENT, on);
  }, [load]);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Pasien</h1>
        {canCreate && <Link href="/dashboard/pasien/baru" className="btn btn-primary">Pasien baru</Link>}
      </div>
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, No. RM, NIK (16 digit), atau No. HP" aria-label="Cari pasien" />
      <div className="mt-5">
        {err ? <p className="text-sm text-red-400">Gagal memuat pasien.</p> : !rows ? <Skeleton /> : rows.length === 0 ? <Empty>{q ? "Tidak ada pasien yang cocok." : "Belum ada pasien terdaftar."}</Empty> : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/pasien/${p.id}`} className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-fg/5">
                  <span className="min-w-0"><span className="block font-medium">{p.name}</span><span className="text-xs text-muted">{p.rmNo ? `RM ${p.rmNo}` : "Belum ada RM"} · {p.idMasked} · {p.phone}</span></span>
                  <span className="flex gap-1.5">{p.duplicate && <Badge tone="warn">kemungkinan duplikat</Badge>}{p.status === "terverifikasi" ? <Badge tone="ok">terverifikasi</Badge> : <Badge tone="warn">belum terverifikasi</Badge>}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type Detail = P & { birthPlace: string; address: Record<string, string>; health: Record<string, unknown>; emergency: { name: string; relation: string; phone: string }; duplicateOf: string | null };
export function PatientProfile({ id, canVerify, canBook, role, userId }: { id: string; canVerify: boolean; canBook: boolean; role: "superadmin" | "dokter" | "staf"; userId: string }) {
  const [p, setP] = useState<Detail | null>(null);
  const [appts, setAppts] = useState<A[]>([]);
  const [err, setErr] = useState(false);
  const load = () => api<{ patient: Detail; appointments: A[] }>(`/api/patients/${id}`).then((d) => (d.ok ? (setP(d.patient), setAppts(d.appointments)) : setErr(true)));
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Empty>Pasien tidak ditemukan.</Empty>;
  if (!p) return <Skeleton />;
  const h = p.health as Record<string, string | string[]>;
  const rows: [string, string][] = [["Tanggal lahir", `${fmtDate(p.birthDate)} · ${p.birthPlace}`], ["Jenis kelamin", p.gender === "L" ? "Laki-laki" : "Perempuan"], ["No. HP", p.phone], ["Identitas", p.idMasked], ["Alamat", [p.address.address, p.address.village, p.address.district, p.address.city, p.address.province].filter(Boolean).join(", ")], ["Alergi", String(h.allergies || "-")], ["Riwayat penyakit", [...((h.conditions as string[]) ?? []), h.conditionsOther].filter(Boolean).join(", ") || "-"], ["Obat rutin", String(h.medications || "-")], ["Kontak darurat", `${p.emergency.name} (${p.emergency.relation}) ${p.emergency.phone}`]];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="display text-3xl">{p.name}</h1><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{p.rmNo ? `RM ${p.rmNo}` : "Belum ada No. RM"}{p.status === "terverifikasi" ? <Badge tone="ok">terverifikasi</Badge> : <Badge tone="warn">belum terverifikasi</Badge>}{p.hasAccount && <Badge>punya akun portal</Badge>}</p></div>
        <div className="flex gap-2">
          {canVerify && p.status !== "terverifikasi" && <button className="btn btn-primary" onClick={async () => (await api(`/api/patients/${id}/verify`, "POST"), void load())}>Verifikasi & terbitkan RM</button>}
          {canBook && <Link href={`/dashboard/janji?patient=${id}`} className="btn btn-ghost">Buat janji</Link>}
        </div>
      </div>
      {p.duplicateOf && <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">Data ini mirip dengan pasien lain. Periksa sebelum menerbitkan RM.{" "}<Link className="underline" href={`/dashboard/pasien/${p.duplicateOf}`}>Lihat yang mirip</Link></p>}
      <Card title="Ringkasan"><dl className="grid gap-4 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>)}</dl></Card>
      <Card title="Riwayat janji">
        {appts.length === 0 ? <Empty>Belum ada janji.</Empty> : (
          <ul className="space-y-3">{appts.map((a) => <li key={a.id} className="rounded-xl border border-line p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{fmtDate(a.date)} · {a.time} · {a.doctorName}</span><StatusBadge s={a.status} /></div>{a.complaint && <p className="mt-1 text-muted">{a.complaint}</p>}<ApptActions a={a} role={role} userId={userId} reload={() => void load()} /></li>)}</ul>
        )}
      </Card>
      {role !== "dokter" && role !== "staf" && role !== "superadmin" ? null : <Card title="Riwayat kunjungan klinis"><VisitHistory patientId={id} /></Card>}
      <div className="grid gap-5 sm:grid-cols-2"><Card title="Berkas"><Empty>Upload rontgen dan foto klinis menyusul (butuh token Vercel Blob).</Empty></Card><Card title="Tagihan"><Empty>Tagihan tersedia di Fase 4.</Empty></Card></div>
    </div>
  );
}
