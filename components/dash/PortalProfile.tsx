"use client";

import { useEffect, useState } from "react";
import { Badge, Skeleton, api, fmtDate } from "./kit";

type P = {
  name: string; rmNo: string | null; status: string; gender: "L" | "P"; birthDate: string; birthPlace: string; idType: string; idMasked: string; phone: string; email?: string;
  address: Record<string, string | undefined>; health: Record<string, unknown>; emergency: { name: string; relation: string; phone: string };
};
const row = (k: string, v?: React.ReactNode) => v ? <div key={k} className="grid grid-cols-[9rem_1fr] gap-2 py-2 text-sm"><dt className="text-muted">{k}</dt><dd>{v}</dd></div> : null;
const list = (v: unknown) => Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : undefined;

/** Biodata the patient entered at registration, plus the medical record number once issued. */
export default function PortalProfile() {
  const [p, setP] = useState<P | null | undefined>(undefined);
  useEffect(() => void api<{ patient: P | null }>("/api/portal/profil").then((r) => setP(r.ok ? r.patient : null)), []);
  if (p === undefined) return <Skeleton />;
  if (!p) return <p className="glass rounded-2xl p-5 text-sm text-muted">Data pasien belum tersedia. Hubungi klinik.</p>;
  const a = p.address;
  return (
    <section className="glass rounded-2xl p-5 sm:p-6" aria-labelledby="bio-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bio-h" className="display text-xl">Biodata pasien</h2>
        <Badge tone={p.rmNo ? "ok" : "warn"}>{p.rmNo ? `No. RM ${p.rmNo}` : "No. RM belum terbit"}</Badge>
      </div>
      {!p.rmNo && <p className="mt-2 text-xs text-muted">Nomor rekam medis diterbitkan klinik setelah identitas Anda dicocokkan saat kunjungan pertama.</p>}
      <dl className="mt-3 divide-y divide-line">
        {row("Nama", p.name)}
        {row(p.idType === "wna" ? "Paspor" : "NIK", p.idMasked)}
        {row("Jenis kelamin", p.gender === "L" ? "Laki-laki" : "Perempuan")}
        {row("Tempat, tgl lahir", `${p.birthPlace}, ${fmtDate(p.birthDate)}`)}
        {row("Telepon", p.phone)}
        {row("Email", p.email)}
        {row("Alamat", [a.address, a.rt && `RT ${a.rt}`, a.rw && `RW ${a.rw}`, a.village, a.district, a.city, a.province, a.postal].filter(Boolean).join(", "))}
        {row("Pekerjaan", list(p.health.occupation))}
        {row("Golongan darah", list(p.health.bloodType))}
        {row("Alergi", list(p.health.allergies))}
        {row("Penyakit penyerta", list(p.health.conditions))}
        {row("Obat rutin", list(p.health.medications))}
        {row("Kontak darurat", p.emergency.name ? `${p.emergency.name} (${p.emergency.relation}) · ${p.emergency.phone}` : undefined)}
      </dl>
      <p className="mt-3 text-xs text-muted">Untuk mengubah data identitas, hubungi klinik agar tercatat dengan benar.</p>
    </section>
  );
}
