"use client";

import { useCallback, useEffect, useState } from "react";
import { doctors as siteDoctors } from "@/lib/content";
import { Badge, Card, ConfirmBtn, Empty, Field, Input, Select, Skeleton, Tabs, addD, api, witaToday } from "./kit";

type U = { id: string; email: string; name: string; role: string; subRole?: string; active: boolean; totpEnabled: boolean; pendingInvite: boolean };
type Matrix = { perms: string[]; roles: string[]; allowed: Record<string, boolean[]> };
type Sess = { start: string; end: string };
type Sched = { slotMinutes: number; poliklinikId?: string; days: Record<string, Sess[]>; leave?: string[] };
type Doc = { id: string; name: string; schedule: Sched | null };
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ROLE_LABEL: Record<string, string> = { superadmin: "Superadmin", dokter: "Dokter", staf: "Staf", apoteker: "Apoteker", pasien: "Pasien" };

function Users() {
  const [rows, setRows] = useState<U[] | null>(() => api.getCache<{ users: U[] }>("/api/team/users")?.users ?? null);
  const [manageable, setManageable] = useState<string[]>(() => api.getCache<{ manageable: string[] }>("/api/team/users")?.manageable ?? []);
  const [me, setMe] = useState(() => api.getCache<{ me: string }>("/api/team/users")?.me ?? "");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ email: "", name: "", role: "", subRole: "perawat" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await api<{ users: U[]; manageable: string[]; me: string }>("/api/team/users");
    if (!d.ok) return setErr("Gagal memuat pengguna.");
    setRows(d.users);
    setManageable(d.manageable);
    setMe(d.me);
    setF((x) => ({ ...x, role: x.role || d.manageable[0] || "" }));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const d = await api<{ mailSent: boolean }>("/api/team/users", "POST", { email: f.email, name: f.name, role: f.role, subRole: f.role === "staf" ? f.subRole : undefined });
    setBusy(false);
    if (!d.ok) return setMsg(d.message ?? "Gagal membuat akun.");
    setMsg(d.mailSent ? "Undangan terkirim ke email." : "Akun dibuat, tetapi email gagal terkirim. Gunakan Kirim ulang.");
    setF({ ...f, email: "", name: "" });
    void load();
  }
  async function act(id: string, action: string) {
    const d = await api<{ mailSent?: boolean }>(`/api/team/users/${id}`, "PATCH", { action });
    setMsg(d.ok ? (action === "resend" ? (d.mailSent ? "Undangan dikirim ulang." : "Email gagal terkirim.") : "Tersimpan.") : (d.message ?? "Tidak diizinkan."));
    void load();
  }

  return (
    <div className="space-y-5">
      {manageable.length > 0 && (
        <Card title="Undang pengguna">
          <form toolname="invite_team_user" tooldescription="Undang anggota tim baru (dokter, staf, atau apoteker) ke Estaka Dental Clinic." onSubmit={invite} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
            <Field label="Peran">
              <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                {manageable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            </Field>
            {f.role === "staf" && (
              <Field label="Sub-peran">
                <Select value={f.subRole} onChange={(e) => setF({ ...f, subRole: e.target.value })}>
                  <option value="perawat">Perawat</option><option value="resepsionis">Resepsionis</option><option value="kasir">Kasir</option>
                </Select>
              </Field>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="btn btn-primary disabled:opacity-50" disabled={busy || !f.email || !f.name}>{busy ? "Mengirim…" : "Kirim undangan"}</button>
              <span role="status" className="ml-4 text-sm text-muted">{msg}</span>
            </div>
          </form>
        </Card>
      )}
      <Card title="Pengguna">
        {err ? <p className="text-sm text-red-400">{err}</p> : !rows ? <Skeleton /> : rows.length === 0 ? <Empty>Belum ada pengguna.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-2 pr-4">Nama</th><th className="pr-4">Peran</th><th className="pr-4">Status</th><th className="pr-4">2FA</th><th /></tr></thead>
              <tbody>
                {rows.map((u) => {
                  const mine = u.id === me;
                  const canManage = !mine && manageable.includes(u.role);
                  return (
                    <tr key={u.id} className="border-t border-line align-top">
                      <td className="py-3 pr-4"><p className="font-medium">{u.name}{mine && " (Anda)"}</p><p className="text-xs text-muted">{u.email}</p></td>
                      <td className="pr-4">{ROLE_LABEL[u.role]}{u.subRole && <span className="text-muted"> · {u.subRole}</span>}</td>
                      <td className="pr-4">{!u.active ? <Badge tone="bad">nonaktif</Badge> : u.pendingInvite ? <Badge tone="warn">menunggu</Badge> : <Badge tone="ok">aktif</Badge>}</td>
                      <td className="pr-4">{u.totpEnabled ? <Badge tone="ok">aktif</Badge> : <Badge>belum</Badge>}</td>
                      <td className="py-3 text-right">
                        {canManage && (
                          <span className="inline-flex flex-wrap justify-end gap-1.5">
                            {u.pendingInvite && <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-fg" onClick={() => act(u.id, "resend")}>Kirim ulang</button>}
                            {u.totpEnabled && <ConfirmBtn label="Reset 2FA" onConfirm={() => act(u.id, "reset2fa")} />}
                            {u.active ? <ConfirmBtn danger label="Nonaktifkan" onConfirm={() => act(u.id, "deactivate")} /> : <ConfirmBtn label="Aktifkan" onConfirm={() => act(u.id, "activate")} />}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Roles({ m }: { m: Matrix }) {
  return (
    <Card title="Peran & izin">
      <p className="mb-4 text-sm text-muted">Matriks izin ditetapkan di kode dan diuji otomatis, sehingga tidak bisa diubah dari layar ini. Perubahan dilakukan lewat rilis.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-2 pr-4">Izin</th>{m.roles.map((r) => <th key={r} className="px-2 text-center">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {m.perms.map((p, i) => (
              <tr key={p} className="border-t border-line">
                <td className="py-2 pr-4 font-mono text-xs">{p}</td>
                {m.roles.map((r) => <td key={r} className="px-2 text-center">{m.allowed[r][i] ? <span role="img" className="text-accent" aria-label="diizinkan">✓</span> : <span role="img" className="text-muted" aria-label="tidak">–</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DoctorSchedule({ d, canEdit, polis }: { d: Doc; canEdit: boolean; polis: { id: string; name: string }[] }) {
  const [s, setS] = useState<Sched>(d.schedule ?? { slotMinutes: 30, days: {} });
  const [msg, setMsg] = useState("");
  const set = (day: number, list: Sess[]) => setS({ ...s, days: { ...s.days, [day]: list } });
  async function save() {
    const d2 = await api(`/api/team/schedules/${d.id}`, "PUT", s);
    setMsg(d2.ok ? "Jadwal disimpan." : (d2.message ?? "Gagal menyimpan."));
  }
  return (
    <Card title={d.name} right={canEdit ? <button className="btn btn-primary" onClick={save}>Simpan</button> : <Badge>hanya lihat</Badge>}>
      <div className="mb-4 flex flex-wrap gap-3"><div className="min-w-56"><Field label="Poliklinik"><Select disabled={!canEdit} value={s.poliklinikId ?? ""} onChange={(e) => setS({ ...s, poliklinikId: e.target.value || undefined })}><option value="">Semua poliklinik</option>{polis.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div><div className="max-w-48"><Field label="Durasi slot"><Select disabled={!canEdit} value={s.slotMinutes} onChange={(e) => setS({ ...s, slotMinutes: Number(e.target.value) })}>{[15, 20, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} menit</option>)}</Select></Field></div></div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const list = s.days[day] ?? [];
          return (
            <div key={day} className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm">
              <span className="w-20 shrink-0">{DAYS[day]}</span>
              {list.length === 0 && <span className="text-muted">libur</span>}
              {list.map((x, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <input name="start" type="time" disabled={!canEdit} value={x.start} onChange={(e) => set(day, list.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)))} className="min-h-10 rounded-lg border border-line bg-bg px-2" aria-label={`${DAYS[day]} mulai`} />–
                  <input name="end" type="time" disabled={!canEdit} value={x.end} onChange={(e) => set(day, list.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)))} className="min-h-10 rounded-lg border border-line bg-bg px-2" aria-label={`${DAYS[day]} selesai`} />
                  {canEdit && <button className="px-1 text-muted hover:text-red-300" aria-label="Hapus sesi" onClick={() => set(day, list.filter((_, j) => j !== i))}>×</button>}
                </span>
              ))}
              {canEdit && list.length < 4 && <button className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-fg" onClick={() => set(day, [...list, { start: "09:00", end: "12:00" }])}>+ sesi</button>}
            </div>
          );
        })}
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-muted">{msg}</p>
    </Card>
  );
}

function ImportDoctors({ onDone }: { onDone: () => void }) {
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ name: string; status: string; schedule: boolean; placeholderEmail: boolean }[] | null>(null);
  const [msg, setMsg] = useState("");
  const run = async () => {
    setMsg("");
    const r = await api<{ doctors: NonNullable<typeof res> }>("/api/team/import-doctors", "POST", { emails });
    if (r.ok) { setRes(r.doctors); onDone(); } else setMsg(r.message ?? "Gagal mengimpor.");
  };
  return (
    <Card title="Impor dokter dari profil situs">
      <p className="text-sm text-muted">Membuat akun dokter dan jadwal awal (Senin sampai Sabtu 09:00 sampai 17:00) untuk dokter yang tampil di situs namun belum punya akun, supaya muncul di formulir reservasi. Isi email asli bila ada; kosong berarti email sementara yang harus diganti. Akun yang sudah ada tidak diubah.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {siteDoctors.map((d) => (
          <Field key={d.id} label={d.name}><Input type="email" value={emails[d.id] ?? ""} onChange={(e) => setEmails({ ...emails, [d.id]: e.target.value })} placeholder="email dokter (opsional)" /></Field>
        ))}
      </div>
      <button className="btn btn-primary mt-4" onClick={run}>Impor dokter</button>
      {msg && <p role="alert" className="mt-3 text-sm text-red-300">{msg}</p>}
      {res && <ul role="status" className="mt-3 space-y-1 text-sm">{res.map((r) => <li key={r.name}>{r.name}: {r.status === "dibuat" ? "dibuat" : "sudah ada"}{r.placeholderEmail ? " (email sementara, ganti di tab Pengguna)" : ""}</li>)}</ul>}
    </Card>
  );
}

function Schedules({ isSuper }: { isSuper: boolean }) {
  const [n, setN] = useState(0);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [polis, setPolis] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => void api<{ poliklinik: { id: string; name: string }[] }>("/api/booking/options").then((o) => o.ok && setPolis(o.poliklinik)), []);
  useEffect(() => void api<{ doctors: Doc[]; canEdit: boolean }>("/api/team/schedules").then((d) => (setDocs(d.ok ? d.doctors : []), setCanEdit(Boolean(d.canEdit)))), [n]);
  if (!docs) return <Skeleton />;
  return (
    <div className="space-y-5">
      {isSuper && <ImportDoctors onDone={() => setN((x) => x + 1)} />}
      {!docs.length && <Empty>Belum ada dokter. Impor dari profil situs di atas, atau undang dokter di tab Pengguna.</Empty>}
      {docs.map((d) => <DoctorSchedule key={d.id} d={d} canEdit={canEdit} polis={polis} />)}
    </div>
  );
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HEAD = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Interactive month grid: click a day to mark doctor leave (cuti); patients cannot book those dates. */
function LeaveCalendar({ isSuper }: { isSuper: boolean }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [sel, setSel] = useState("");
  const [ym, setYm] = useState(() => witaToday().slice(0, 7));
  const [leave, setLeave] = useState<string[]>([]);
  const [anchor, setAnchor] = useState("");
  const [booked, setBooked] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const today = witaToday();
  const doc = docs?.find((d) => d.id === sel);

  useEffect(() => void api<{ doctors: Doc[] }>("/api/team/schedules").then((d) => {
    const l = d.ok ? d.doctors : [];
    setDocs(l);
    if (l[0]) { setSel(l[0].id); setLeave(l[0].schedule?.leave ?? []); }
  }), []);

  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const first = `${ym}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + total) / 7) * 7 }, (_, i) => (i < lead || i >= lead + total ? null : `${ym}-${String(i - lead + 1).padStart(2, "0")}`));

  useEffect(() => {
    if (!sel) return;
    let live = true;
    void api<{ appointments: { date: string }[] }>(`/api/appointments?doctor=${sel}&from=${first}&to=${ym}-${String(total).padStart(2, "0")}&status=menunggu,dikonfirmasi,checkin,dipanggil,dikursi`).then((r) => {
      if (!live || !r.ok) return;
      const c: Record<string, number> = {};
      for (const a of r.appointments) c[a.date] = (c[a.date] ?? 0) + 1;
      setBooked(c);
    });
    return () => { live = false; };
  }, [sel, first, ym, total]);

  const weekdayOpen = (iso: string) => Boolean(doc?.schedule?.days[new Date(`${iso}T00:00:00Z`).getUTCDay()]?.length);
  const pick = (id: string) => { setSel(id); setLeave(docs?.find((d) => d.id === id)?.schedule?.leave ?? []); setDirty(false); setMsg(""); setAnchor(""); };
  const toggle = (iso: string, range: boolean) => {
    if (!isSuper || iso < today) return;
    setMsg(""); setDirty(true);
    if (range && anchor) {
      const [a, b] = anchor < iso ? [anchor, iso] : [iso, anchor];
      const span: string[] = [];
      for (let d = a; d <= b && span.length < 120; d = addD(d, 1)) if (weekdayOpen(d)) span.push(d);
      const all = span.every((d) => leave.includes(d));
      setLeave((l) => (all ? l.filter((d) => !span.includes(d)) : [...new Set([...l, ...span])].sort()));
      setAnchor("");
    } else {
      setLeave((l) => (l.includes(iso) ? l.filter((d) => d !== iso) : [...l, iso].sort()));
      setAnchor(iso);
    }
  };
  async function save() {
    if (!doc?.schedule) return setMsg("Atur jadwal praktik dokter ini terlebih dulu.");
    const upcoming = leave.filter((d) => d >= today);
    const r = await api(`/api/team/schedules/${doc.id}`, "PUT", { ...doc.schedule, leave: upcoming });
    if (r.ok) {
      setLeave(upcoming); setDirty(false);
      setDocs((l) => l?.map((d) => (d.id === doc.id ? { ...d, schedule: { ...d.schedule!, leave: upcoming } } : d)) ?? l);
      setMsg("Kalender cuti disimpan. Tanggal ini tidak bisa dipilih pasien.");
    } else setMsg(r.message ?? "Gagal menyimpan.");
  }
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  const clash = leave.filter((d) => booked[d]);

  if (!docs) return <Skeleton />;
  if (!docs.length) return <Empty>Belum ada dokter. Impor dari tab Jadwal praktik atau undang dokter di tab Pengguna.</Empty>;
  return (
    <Card title="Kalender cuti dokter" right={isSuper ? <button className="btn btn-primary" onClick={save} disabled={!dirty}>Simpan</button> : <Badge>hanya lihat</Badge>}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56"><Field label="Dokter"><Select value={sel} onChange={(e) => pick(e.target.value)}>{docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field></div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-ghost" aria-label="Bulan sebelumnya" onClick={() => shift(-1)}>‹</button>
          <span className="min-w-36 text-center font-medium" aria-live="polite">{MONTHS[m - 1]} {y}</span>
          <button className="btn btn-ghost" aria-label="Bulan berikutnya" onClick={() => shift(1)}>›</button>
          <button className="btn btn-ghost" onClick={() => setYm(today.slice(0, 7))}>Hari ini</button>
        </div>
      </div>
      <div role="group" aria-label={`Kalender ${MONTHS[m - 1]} ${y}`} className="grid grid-cols-7 gap-1 text-sm">
        {HEAD.map((h) => <div key={h} aria-hidden className="py-1 text-center text-xs text-muted">{h}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const off = leave.includes(iso), open = weekdayOpen(iso), past = iso < today, n = booked[iso] ?? 0;
          const cls = off ? "border-[var(--bad)] bg-[var(--bad)]/15 font-medium text-[var(--bad)]" : !open ? "border-line bg-fg/5 text-muted" : "border-line hover:border-accent";
          return (
            <button key={iso} data-day aria-pressed={off} disabled={!isSuper || past} onClick={(e) => toggle(iso, e.shiftKey || Boolean(anchor && anchor !== iso))}
              aria-label={`${iso}${off ? ", cuti" : open ? ", praktik" : ", libur mingguan"}${n ? `, ${n} janji aktif` : ""}`}
              className={`flex min-h-16 flex-col items-start justify-between rounded-xl border p-2 text-left transition-colors disabled:cursor-default ${past ? "opacity-40" : ""} ${iso === today ? "ring-1 ring-accent" : ""} ${cls}`}>
              <span className="font-medium">{Number(iso.slice(8))}</span>
              <span className="text-[11px] leading-tight">{off ? "Cuti" : !open ? "Libur" : n ? `${n} janji` : ""}</span>
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><li>Merah: cuti</li><li>Abu-abu: libur mingguan</li><li>Klik tanggal untuk cuti, klik tanggal kedua untuk memilih rentang</li></ul>
      {clash.length > 0 && <p role="alert" className="mt-3 text-sm text-[var(--bad)]">Perhatian: {clash.map((d) => `${d.slice(8)}/${d.slice(5, 7)} (${booked[d]})`).join(", ")} masih punya janji aktif. Janji tidak dibatalkan otomatis, jadwalkan ulang secara manual.</p>}
      <p role="status" className="mt-3 min-h-5 text-sm text-muted">{msg}</p>
    </Card>
  );
}

export default function Team({ matrix, isSuper }: { matrix: Matrix; isSuper: boolean }) {
  const [tab, setTab] = useState("users");
  const tabs: [string, string][] = [["users", "Pengguna"], ["roles", "Peran & izin"], ["sched", "Jadwal praktik"], ["cal", "Kalender"]];
  return (
    <div>
      <h1 className="display mb-6 text-3xl">Tim & Akses</h1>
      <Tabs tabs={isSuper ? tabs : tabs.filter(([id]) => id !== "roles")} value={tab} onChange={setTab} />
      {tab === "users" && <Users />}
      {tab === "roles" && <Roles m={matrix} />}
      {tab === "sched" && <Schedules isSuper={isSuper} />}
      {tab === "cal" && <LeaveCalendar isSuper={isSuper} />}
    </div>
  );
}
