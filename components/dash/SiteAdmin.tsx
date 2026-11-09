"use client";

import { useEffect, useState } from "react";
import { Card, Empty, Field, Input, Skeleton, Tabs, api } from "@/components/dash/kit";
import { DEFAULT_WA_TEMPLATE, fillWa, mapEmbedSrc, siteImg } from "@/lib/site-helpers";
import type { SiteContent } from "@/lib/site-types";

const uid = () => Math.random().toString(36).slice(2, 10);
const area = "min-h-24 w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent";

async function upload(file: File, kind: "team" | "result"): Promise<string | null> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("kind", kind);
  const r = await fetch("/api/site/upload", { method: "POST", body: fd }).then((x) => x.json()).catch(() => null);
  return r?.ok ? r.key : null;
}

function Photo({ label, value, kind, onChange }: { label: string; value?: string; kind: "team" | "result"; onChange: (k: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="text-sm">
      <p className="mb-1 text-muted">{label}</p>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={siteImg(value)} alt="" className="size-16 object-cover" /> : <span className="text-xs text-muted">kosong</span>}
        </div>
        <label className="btn btn-ghost min-h-10 cursor-pointer">
          {busy ? "Mengunggah…" : "Pilih foto"}
          <input name="siteadmin-input-32" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true); setErr("");
            const k = await upload(f, kind);
            setBusy(false);
            if (k) onChange(k); else setErr("Gagal mengunggah (maks 6 MB, JPG/PNG/WebP).");
            e.target.value = "";
          }} />
        </label>
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-[var(--bad)]">{err}</p>}
    </div>
  );
}

function Rows<T extends { id: string }>({ items, onChange, make, empty, addLabel, render }: { items: T[]; onChange: (x: T[]) => void; make: () => T; empty: string; addLabel: string; render: (it: T, set: (p: Partial<T>) => void) => React.ReactNode }) {
  return (
    <div className="space-y-4">
      {items.length === 0 && <Empty>{empty}</Empty>}
      {items.map((it) => (
        <div key={it.id} className="rounded-2xl border border-line bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">{render(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}</div>
          <button type="button" className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-fg" onClick={() => confirm("Hapus item ini?") && onChange(items.filter((x) => x.id !== it.id))}>Hapus</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost min-h-11" onClick={() => onChange([...items, make()])}>{addLabel}</button>
    </div>
  );
}

/** Superadmin editor for landing content: team, results, testimonials, map/contact and the WhatsApp reminder template. */
export default function SiteAdmin() {
  const [site, setSite] = useState<SiteContent | null>(() => api.getCache<{ site: SiteContent }>("/api/site")?.site ?? null);
  const [tab, setTab] = useState("team");
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => void api<{ site: SiteContent }>("/api/site").then((r) => r.ok && setSite((r as unknown as { site: SiteContent }).site)), 0);
    return () => clearTimeout(t);
  }, []);
  if (!site) return <Skeleton />;
  const set = (p: Partial<SiteContent>) => (setSite({ ...site, ...p }), setDirty(true), setState(""));
  const save = async () => {
    setState("saving");
    const r = await api("/api/site", "PUT", site);
    setState(r.ok ? "saved" : "error");
    if (r.ok) setDirty(false);
    else alert(r.message ?? "Gagal menyimpan.");
  };
  const embed = mapEmbedSrc(site.clinic);
  const sample = fillWa(site.wa.template, { nama: "Budi", tanggal: "Sabtu, 7 Nov 2026", jam: "10:00", dokter: "drg. Tasya", klinik: "Estaka Dental Clinic" });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">Konten situs</h1>
          <p className="mt-1 text-sm text-muted">Perubahan tampil di landing page dalam ±1 menit setelah disimpan.</p>
        </div>
        <div className="flex items-center gap-3">
          <p role="status" className="text-sm text-muted">{state === "saving" ? "Menyimpan…" : state === "saved" ? "Tersimpan" : state === "error" ? "Gagal" : dirty ? "Belum disimpan" : ""}</p>
          <button className="btn btn-primary min-h-11" onClick={save} disabled={!dirty || state === "saving"}>Simpan</button>
        </div>
      </div>
      <Tabs tabs={[["team", "Tim"], ["results", "Hasil perawatan"], ["testi", "Testimoni"], ["map", "Peta & kontak"], ["wa", "Pengingat WhatsApp"]]} value={tab} onChange={setTab} />

      {tab === "team" && (
        <Rows<SiteContent["team"][number]> items={site.team} onChange={(team) => set({ team })} make={() => ({ id: uid(), name: "", roleId: "" })} empty="Belum ada anggota tim. Bagian Tim di landing tersembunyi sampai ada isinya." addLabel="Tambah anggota"
          render={(m, p) => (<>
            <Field label="Nama"><Input value={m.name} onChange={(e) => p({ name: e.target.value })} /></Field>
            <Field label="Peran (Indonesia)"><Input value={m.roleId} onChange={(e) => p({ roleId: e.target.value })} /></Field>
            <Field label="Peran (Inggris, opsional)"><Input value={m.roleEn ?? ""} onChange={(e) => p({ roleEn: e.target.value })} /></Field>
            <Photo label="Foto (rasio 3:4)" kind="team" value={m.photo} onChange={(photo) => p({ photo })} />
          </>)} />
      )}
      {tab === "results" && (
        <>
          <p className="mb-3 text-sm text-muted">Gunakan foto pasien hanya dengan persetujuan tertulis.</p>
          <Rows<SiteContent["results"][number]> items={site.results} onChange={(results) => set({ results })} make={() => ({ id: uid(), titleId: "", before: "", after: "" })} empty="Belum ada hasil perawatan." addLabel="Tambah kasus"
            render={(r, p) => (<>
              <Field label="Judul (Indonesia)"><Input value={r.titleId} onChange={(e) => p({ titleId: e.target.value })} /></Field>
              <Field label="Judul (Inggris, opsional)"><Input value={r.titleEn ?? ""} onChange={(e) => p({ titleEn: e.target.value })} /></Field>
              <Photo label="Sebelum" kind="result" value={r.before} onChange={(before) => p({ before })} />
              <Photo label="Sesudah" kind="result" value={r.after} onChange={(after) => p({ after })} />
            </>)} />
        </>
      )}
      {tab === "testi" && (
        <>
          <p className="mb-3 text-sm text-muted">Hanya ulasan asli dan dengan izin pemberi ulasan.</p>
          <Rows<SiteContent["testimonials"][number]> items={site.testimonials} onChange={(testimonials) => set({ testimonials })} make={() => ({ id: uid(), quote: "", name: "" })} empty="Belum ada testimoni." addLabel="Tambah testimoni"
            render={(t, p) => (<>
              <div className="sm:col-span-2"><Field label="Kutipan"><textarea name="quote" className={area} value={t.quote} onChange={(e) => p({ quote: e.target.value })} /></Field></div>
              <Field label="Nama"><Input value={t.name} onChange={(e) => p({ name: e.target.value })} /></Field>
              <Field label="Perawatan (opsional)"><Input value={t.treatment ?? ""} onChange={(e) => p({ treatment: e.target.value })} /></Field>
            </>)} />
        </>
      )}
      {tab === "map" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Alamat & kontak">
            <div className="space-y-3">
              <Field label="Alamat" hint="Kosongkan untuk memakai NEXT_PUBLIC_ADDRESS dari .env"><Input value={site.clinic.address ?? ""} onChange={(e) => set({ clinic: { ...site.clinic, address: e.target.value } })} /></Field>
              <Field label="Embed Google Maps" hint="Google Maps > Bagikan > Sematkan peta > salin HTML, lalu tempel di sini (iframe atau URL). Kosong = peta bawaan."><textarea name="siteadmin-textarea-136" className="min-h-20 w-full rounded-xl border border-line bg-transparent p-3 text-sm" value={site.clinic.mapsEmbed ?? ""} onChange={(e) => set({ clinic: { ...site.clinic, mapsEmbed: e.target.value } })} placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>' /></Field>
              <Field label="Teks pencarian peta (dipakai bila embed kosong)" hint="Mis. nama klinik + kota. Kosong = pakai alamat."><Input value={site.clinic.mapsQuery ?? ""} onChange={(e) => set({ clinic: { ...site.clinic, mapsQuery: e.target.value } })} /></Field>
              <Field label="Tautan Google Maps (tombol Petunjuk arah)"><Input value={site.clinic.mapsUrl ?? ""} onChange={(e) => set({ clinic: { ...site.clinic, mapsUrl: e.target.value } })} placeholder="https://maps.app.goo.gl/…" /></Field>
              <Field label="Telepon"><Input value={site.clinic.phone ?? ""} onChange={(e) => set({ clinic: { ...site.clinic, phone: e.target.value } })} /></Field>
              <Field label="Nomor WhatsApp (62…)"><Input value={site.clinic.whatsapp ?? ""} onChange={(e) => set({ clinic: { ...site.clinic, whatsapp: e.target.value.replace(/\D/g, "") } })} /></Field>
            </div>
          </Card>
          <Card title="Pratinjau peta">
            {embed ? <iframe title="Pratinjau peta" src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="aspect-[4/3] w-full rounded-xl border border-line" /> : <Empty>Isi alamat atau teks pencarian.</Empty>}
          </Card>
        </div>
      )}
      {tab === "wa" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Template pengingat">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><input name="site" type="checkbox" checked={site.wa.enabled} onChange={(e) => set({ wa: { ...site.wa, enabled: e.target.checked } })} /> Aktifkan tab Pengingat untuk staf</label>
              <label className="flex items-center gap-2 text-sm"><input name="site" type="checkbox" checked={site.wa.email !== false} onChange={(e) => set({ wa: { ...site.wa, email: e.target.checked } })} /> Kirim juga pengingat email (H-1 dan 2 jam sebelum)</label>
              <Field label="Kirim pengingat berapa jam sebelum janji"><Input type="number" min={1} max={72} value={site.wa.hoursBefore} onChange={(e) => set({ wa: { ...site.wa, hoursBefore: Math.max(1, Math.min(72, Number(e.target.value) || 24)) } })} /></Field>
              <Field label="Isi pesan" hint="Variabel: {nama} {tanggal} {jam} {dokter} {klinik}"><textarea name="template" className={area} value={site.wa.template} onChange={(e) => set({ wa: { ...site.wa, template: e.target.value } })} /></Field>
              <button type="button" className="text-sm text-muted underline underline-offset-4" onClick={() => set({ wa: { ...site.wa, template: DEFAULT_WA_TEMPLATE } })}>Kembalikan bawaan</button>
            </div>
          </Card>
          <Card title="Contoh pesan"><p className="whitespace-pre-wrap rounded-xl bg-card p-4 text-sm">{sample}</p>
            <p className="mt-3 text-xs text-muted">Pengiriman otomatis lewat webhook Hermes Agent (diatur di .env.local: HERMES_WEBHOOK_URL dan HERMES_WEBHOOK_SECRET) dan dijalankan penjadwal /api/cron/reminders. Tanpa Hermes, staf memakai tombol WhatsApp di Janji &gt; Pengingat.</p></Card>
        </div>
      )}
    </div>
  );
}
