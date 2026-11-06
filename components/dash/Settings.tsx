"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Field, Input, Select, Skeleton, Tabs, api } from "./kit";

type Poli = { id: string; name: string; active: boolean; color: string };
type Pay = { id: string; name: string; kind: "umum" | "asuransi" | "bpjs"; active: boolean; needsNumber: boolean };
type Rules = { monthlyTarget: number; cancelHoursBefore: number; maxActiveBookings: number; slotGapMinutes: number; horizonDays: number };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

function useMaster<T>(kind: string) {
  const [data, setData] = useState<T | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => void api<{ data: T }>(`/api/master/${kind}`).then((d) => d.ok && setData(d.data)), [kind]);
  const save = async () => {
    const d = await api(`/api/master/${kind}`, "PUT", data);
    setMsg(d.ok ? "Tersimpan." : (d.message ?? "Gagal menyimpan."));
  };
  return { data, setData, msg, save };
}
const Save = ({ onClick, msg, canEdit }: { onClick: () => void; msg: string; canEdit: boolean }) =>
  canEdit ? (
    <div className="mt-4 flex items-center gap-4">
      <button className="btn btn-primary" onClick={onClick}>Simpan</button>
      <span role="status" className="text-sm text-muted">{msg}</span>
    </div>
  ) : <p className="mt-4 text-xs text-muted">Hanya superadmin yang dapat mengubah.</p>;

function Backup() {
  const [file, setFile] = useState("");
  const [info, setInfo] = useState<{ at: string; keys: number; groups: Record<string, number> } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const check = async (text: string) => {
    setInfo(null); setMsg("");
    const r = await api<{ at: string; keys: number; groups: Record<string, number> }>("/api/admin/restore", "POST", { file: text, mode: "check" });
    if (r.ok) setInfo(r); else setMsg(r.message ?? "Gagal membaca berkas.");
  };
  const apply = async () => {
    const r = await api<{ restored: number }>("/api/admin/restore", "POST", { file, mode: "apply", confirm });
    setMsg(r.ok ? `${r.restored} data dipulihkan. Semua pengguna perlu masuk ulang bila sesi terpengaruh.` : r.message ?? "Gagal memulihkan.");
    if (r.ok) { setInfo(null); setConfirm(""); }
  };
  return (
    <Card title="Cadangan data">
      <p className="text-sm text-muted">Unduh cadangan lengkap (pasien, kunjungan, tagihan, stok, pengaturan). Berkas dienkripsi dengan ENCRYPTION_KEY; simpan kuncinya terpisah, tanpa kunci berkas tidak bisa dibuka. Sesi login tidak ikut dicadangkan.</p>
      <a className="btn btn-primary mt-4 inline-flex" href="/api/admin/backup" download>Unduh cadangan</a>
      <hr className="my-6 border-line" />
      <h3 className="text-sm font-semibold">Pulihkan dari berkas</h3>
      <p className="mt-1 text-sm text-muted">Data pada berkas akan menimpa data yang sama di sistem. Data yang tidak ada di berkas tidak dihapus.</p>
      <input name="berkas-cadangan" type="file" accept=".enc,text/plain" aria-label="Berkas cadangan" className="mt-3 block text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const t = await f.text(); setFile(t); void check(t); }} />
      {info && (
        <div className="mt-4 rounded-xl border border-line p-4 text-sm">
          <p>Cadangan tanggal <b>{info.at ? new Date(info.at).toLocaleString("id-ID") : "-"}</b>, {info.keys} data.</p>
          <p className="mt-1 text-muted">{Object.entries(info.groups).map(([k, n]) => `${k}: ${n}`).join(" · ")}</p>
          <label className="mt-3 block text-xs text-muted" htmlFor="bk-confirm">Ketik PULIHKAN untuk melanjutkan</label>
          <Input id="bk-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn btn-primary mt-3 disabled:opacity-40" disabled={confirm !== "PULIHKAN"} onClick={apply}>Pulihkan sekarang</button>
        </div>
      )}
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    </Card>
  );
}

function IcdAdmin() {
  const [meta, setMeta] = useState<{ count: number; source: string; at: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<{ meta: { count: number; source: string; at: number } }>("/api/icd").then((r) => r.ok && setMeta(r.meta)); }, []);
  return (
    <Card title="Daftar diagnosis ICD-10">
      <p className="text-sm text-muted">Tersimpan di database. Bawaan: {meta ? <b>{meta.count} kode</b> : "…"} ({meta?.source === "who-2019" ? "WHO 2019 lengkap" : "set gigi dan mulut"}). Untuk daftar lengkap WHO, unduh paket teks “ICD-10 2019 plain text” (icd102019enMeta.zip) dari icdcdn.who.int, ekstrak, lalu unggah berkas <b>icd102019syst_codes.txt</b>.</p>
      <input name="icd-file" type="file" accept=".txt,text/plain" aria-label="Berkas kode ICD-10" disabled={busy} className="mt-3 block text-sm" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true); setMsg("");
        const fd = new FormData(); fd.append("file", f);
        const r = await fetch("/api/icd/import", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ ok: false, message: "Gagal mengunggah." }));
        setBusy(false); e.target.value = "";
        setMsg(r.ok ? `${r.count} kode tersimpan.` : r.message ?? "Gagal."); if (r.ok) setMeta({ count: r.count, source: "who-2019", at: Date.now() });
      }} />
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    </Card>
  );
}

function TwoFa({ canEdit }: { canEdit: boolean }) {
  const [p, setP] = useState<Record<string, boolean> | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => void api<{ policy: Record<string, boolean> }>("/api/settings/2fa").then((d) => d.ok && setP(d.policy)), []);
  if (!p) return <Skeleton />;
  const rows: [string, string, boolean][] = [["superadmin", "Superadmin", true], ["dokter", "Dokter", true], ["staf", "Staf", false], ["apoteker", "Apoteker", false], ["pasien", "Pasien", false]];
  return (
    <Card title="Kebijakan 2FA">
      <p className="mb-4 text-sm text-muted">Peran yang diwajibkan harus mengaktifkan 2FA sebelum bisa memakai dashboard. Superadmin dan dokter selalu wajib.</p>
      <ul className="divide-y divide-line">
        {rows.map(([id, label, locked]) => (
          <li key={id} className="flex items-center justify-between py-3 text-sm">
            <span>{label}</span>
            {locked ? <Badge tone="ok">wajib</Badge> : (
              <label className="inline-flex min-h-10 items-center gap-2">
                <input name="settings-input-81" type="checkbox" disabled={!canEdit} checked={p[id]} onChange={(e) => setP({ ...p, [id]: e.target.checked })} className="size-5 accent-[var(--accent)]" />
                {p[id] ? "wajib" : "opsional"}
              </label>
            )}
          </li>
        ))}
      </ul>
      <Save canEdit={canEdit} msg={msg} onClick={async () => { const d = await api("/api/settings/2fa", "PUT", { staf: p.staf, apoteker: p.apoteker, pasien: p.pasien }); setMsg(d.ok ? "Tersimpan." : "Gagal menyimpan."); }} />
    </Card>
  );
}

function Poliklinik({ canEdit }: { canEdit: boolean }) {
  const { data, setData, msg, save } = useMaster<Poli[]>("poliklinik");
  const [name, setName] = useState("");
  if (!data) return <Skeleton />;
  const upd = (i: number, v: Partial<Poli>) => setData(data.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <Card title="Poliklinik">
      <ul className="divide-y divide-line">
        {data.map((x, i) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
            <input name="color" type="color" disabled={!canEdit} value={x.color} onChange={(e) => upd(i, { color: e.target.value })} className="size-9 rounded-lg border border-line bg-transparent" aria-label={`Warna ${x.name}`} />
            <Input disabled={!canEdit} value={x.name} onChange={(e) => upd(i, { name: e.target.value })} className="!mt-0 min-w-48 flex-1" aria-label="Nama poliklinik" />
            <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input name="settings-input-105" type="checkbox" disabled={!canEdit} checked={x.active} onChange={(e) => upd(i, { active: e.target.checked })} className="size-5 accent-[var(--accent)]" />aktif</label>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const id = slug(name); if (id.length < 2 || data.some((x) => x.id === id)) return; setData([...data, { id, name: name.trim(), active: true, color: "#f5b942" }]); setName(""); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Poliklinik baru, mis. Ortodonti" className="!mt-0" />
          <button className="btn btn-ghost shrink-0">Tambah</button>
        </form>
      )}
      <Save canEdit={canEdit} msg={msg} onClick={save} />
    </Card>
  );
}

function PayTypes({ canEdit }: { canEdit: boolean }) {
  const { data, setData, msg, save } = useMaster<Pay[]>("paytypes");
  const [name, setName] = useState("");
  if (!data) return <Skeleton />;
  const upd = (i: number, v: Partial<Pay>) => setData(data.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <Card title="Jenis bayar">
      <p className="mb-3 text-sm text-muted">Aktifkan BPJS hanya bila klinik benar-benar bekerja sama dengan BPJS Kesehatan.</p>
      <ul className="divide-y divide-line">
        {data.map((x, i) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
            <Input disabled={!canEdit} value={x.name} onChange={(e) => upd(i, { name: e.target.value })} className="!mt-0 min-w-48 flex-1" aria-label="Nama jenis bayar" />
            <Badge>{x.kind}</Badge>
            <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input name="settings-input-133" type="checkbox" disabled={!canEdit} checked={x.needsNumber} onChange={(e) => upd(i, { needsNumber: e.target.checked })} className="size-5 accent-[var(--accent)]" />minta nomor kepesertaan</label>
            <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input name="settings-input-134" type="checkbox" disabled={!canEdit} checked={x.active} onChange={(e) => upd(i, { active: e.target.checked })} className="size-5 accent-[var(--accent)]" />aktif</label>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const id = slug(name); if (id.length < 2 || data.some((x) => x.id === id)) return; setData([...data, { id, name: name.trim(), kind: "asuransi", active: true, needsNumber: true }]); setName(""); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama asuransi baru" className="!mt-0" />
          <button className="btn btn-ghost shrink-0">Tambah</button>
        </form>
      )}
      <Save canEdit={canEdit} msg={msg} onClick={save} />
    </Card>
  );
}

function RulesForm({ canEdit }: { canEdit: boolean }) {
  const { data, setData, msg, save } = useMaster<Rules>("rules");
  if (!data) return <Skeleton />;
  const num = (k: keyof Rules, label: string, hint: string, min = 0) => (
    <Field label={label} hint={hint}><Input type="number" min={min} disabled={!canEdit} value={data[k]} onChange={(e) => setData({ ...data, [k]: Number(e.target.value) })} /></Field>
  );
  return (
    <Card title="Aturan janji">
      <div className="grid gap-4 sm:grid-cols-2">
        {num("cancelHoursBefore", "Batas batal/ubah (jam)", "Pasien boleh membatalkan paling lambat sekian jam sebelum janji.")}
        {num("maxActiveBookings", "Maksimal booking aktif", "Per pasien.", 1)}
        {num("slotGapMinutes", "Jeda antar slot (menit)", "Waktu bersih-bersih/persiapan.")}
        {num("monthlyTarget", "Target kunjungan bulanan", "Dipakai pada grafik target di Beranda.", 1)}
        {num("horizonDays", "Horizon booking (hari)", "Seberapa jauh ke depan pasien boleh memesan.", 1)}
      </div>
      <Save canEdit={canEdit} msg={msg} onClick={save} />
    </Card>
  );
}

type Feat = { checkinWindowMin: number; recallRemindDays: number; surveyEnabled: boolean; recall: { id: string; name: string; days: number }[] };
function Features({ canEdit }: { canEdit: boolean }) {
  const { data, setData, msg, save } = useMaster<Feat>("features");
  if (!data) return <Skeleton />;
  const num = (k: "checkinWindowMin" | "recallRemindDays", label: string, hint: string) => (
    <Field label={label} hint={hint}><Input type="number" min={0} disabled={!canEdit} value={data[k]} onChange={(e) => setData({ ...data, [k]: Number(e.target.value) })} /></Field>
  );
  const setR = (i: number, p: Partial<Feat["recall"][number]>) => setData({ ...data, recall: data.recall.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <Card title="Fitur pasien">
      <div className="grid gap-4 sm:grid-cols-2">
        {num("checkinWindowMin", "Jendela tombol “Saya sudah tiba” (menit)", "Pasien baru bisa check-in mandiri sekian menit sebelum jam janji.")}
        {num("recallRemindDays", "Pengingat kontrol (hari sebelumnya)", "Notifikasi otomatis ke pasien sebelum tanggal kontrol/recall.")}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" disabled={!canEdit} checked={data.surveyEnabled} onChange={(e) => setData({ ...data, surveyEnabled: e.target.checked })} />Kirim survei kepuasan setelah kunjungan</label>
      </div>
      <h3 className="mb-2 mt-6 text-sm font-medium">Preset kontrol / recall (dipilih dokter di pemeriksaan)</h3>
      <ul className="space-y-2">
        {data.recall.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[1fr_6rem_auto] gap-2"><Input aria-label="Nama" disabled={!canEdit} value={r.name} onChange={(e) => setR(i, { name: e.target.value })} /><Input aria-label="Hari" type="number" min={1} disabled={!canEdit} value={r.days} onChange={(e) => setR(i, { days: Number(e.target.value) })} />
            {canEdit && <button className="btn btn-ghost min-h-10" onClick={() => setData({ ...data, recall: data.recall.filter((_, j) => j !== i) })}>Hapus</button>}</li>
        ))}
      </ul>
      {canEdit && <button className="btn btn-ghost mt-2 min-h-10" onClick={() => setData({ ...data, recall: [...data.recall, { id: `r-${Date.now().toString(36)}`, name: "Kontrol baru", days: 30 }] })}>+ Preset</button>}
      <Save canEdit={canEdit} msg={msg} onClick={save} />
    </Card>
  );
}

type Doc = { id: string; title: string; body: string; active: boolean; keywords?: string };
function DocEditor({ kind, title, canEdit, keywords }: { kind: "consent" | "edu"; title: string; canEdit: boolean; keywords?: boolean }) {
  const { data, setData, msg, save } = useMaster<Doc[]>(kind);
  if (!data) return <Skeleton />;
  const set = (i: number, p: Partial<Doc>) => setData(data.map((d, j) => (j === i ? { ...d, ...p } : d)));
  return (
    <Card title={title}>
      <ul className="space-y-4">
        {data.map((d, i) => (
          <li key={d.id} className="rounded-xl border border-line p-3">
            <div className="flex gap-2"><Input aria-label="Judul" disabled={!canEdit} value={d.title} onChange={(e) => set(i, { title: e.target.value })} />
              <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" className="size-4" disabled={!canEdit} checked={d.active} onChange={(e) => set(i, { active: e.target.checked })} />Aktif</label></div>
            <textarea aria-label="Isi" rows={5} disabled={!canEdit} value={d.body} onChange={(e) => set(i, { body: e.target.value })} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 text-sm" />
            {keywords && <Input className="mt-2" aria-label="Kata kunci tindakan" placeholder="Kata kunci tindakan (pisahkan koma), mis. cabut, ekstraksi" disabled={!canEdit} value={d.keywords ?? ""} onChange={(e) => set(i, { keywords: e.target.value })} />}
            {canEdit && <button className="btn btn-ghost mt-2 min-h-10" onClick={() => setData(data.filter((_, j) => j !== i))}>Hapus</button>}
          </li>
        ))}
      </ul>
      {canEdit && <button className="btn btn-ghost mt-3 min-h-10" onClick={() => setData([...data, { id: `d-${Date.now().toString(36)}`, title: "Judul baru", body: "Isi dokumen…", active: true, ...(keywords ? { keywords: "" } : {}) }])}>+ Tambah</button>}
      <Save canEdit={canEdit} msg={msg} onClick={save} />
    </Card>
  );
}

export default function Settings({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState("2fa");
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Pengaturan</h1>
      <Tabs tabs={[["2fa", "Kebijakan 2FA"], ["poli", "Poliklinik"], ["pay", "Jenis bayar"], ["rules", "Aturan janji"], ["fitur", "Fitur pasien"], ["consent", "Persetujuan"], ["edu", "Edukasi"], ...(canEdit ? [["icd", "ICD-10"], ["backup", "Cadangan"]] : [])] as [string, string][]} value={tab} onChange={setTab} />
      {tab === "2fa" && <TwoFa canEdit={canEdit} />}
      {tab === "poli" && <Poliklinik canEdit={canEdit} />}
      {tab === "pay" && <PayTypes canEdit={canEdit} />}
      {tab === "rules" && <RulesForm canEdit={canEdit} />}
      {tab === "fitur" && <Features canEdit={canEdit} />}
      {tab === "consent" && <DocEditor kind="consent" title="Template persetujuan tindakan" canEdit={canEdit} />}
      {tab === "edu" && <DocEditor kind="edu" title="Materi edukasi pasca tindakan" canEdit={canEdit} keywords />}
      {tab === "icd" && canEdit && <IcdAdmin />}
      {tab === "backup" && canEdit && <Backup />}
    </div>
  );
}
