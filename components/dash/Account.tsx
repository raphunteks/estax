"use client";

import { useEffect, useState } from "react";
import PwaCard from "./PwaCard";
import { inputCls } from "@/components/auth/ui";

type Sess = { current: boolean; ua: string; ip: string; last: number; created: number };
type Props = { id: string; photo?: string; name: string; email: string; role: string; totpEnabled: boolean; mustChange: boolean; twoFaMandatory: boolean };

const post = (url: string, body?: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then((r) => r.json())
    .catch(() => ({ ok: false }));

function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="glass rounded-2xl p-5 sm:p-6">
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
const Msg = ({ m }: { m: string }) => (
  <p role="status" className="mt-3 min-h-5 text-sm text-muted">
    {m}
  </p>
);

function Password({ mustChange }: { mustChange: boolean }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const d = await post("/api/me/password", { current: cur, next: nw });
    setBusy(false);
    if (d.ok) {
      setMsg("Kata sandi diperbarui.");
      setCur("");
      setNw("");
      if (mustChange) window.location.reload();
    } else setMsg(d.message ?? "Gagal memperbarui. Periksa kata sandi saat ini.");
  }
  return (
    <Card title="Kata sandi">
      {mustChange && <p className="mb-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">Ganti kata sandi awal Anda sebelum melanjutkan.</p>}
      <form onSubmit={save} className="max-w-sm">
        <label className="text-sm font-medium" htmlFor="cur">Kata sandi saat ini</label>
        <input id="cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} />
        <label className="mt-3 block text-sm font-medium" htmlFor="nw">Kata sandi baru</label>
        <input id="nw" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} className={inputCls} />
        <p className="mt-2 text-xs text-muted">Minimal 10 karakter, huruf dan angka.</p>
        <Msg m={msg} />
        <button className="btn btn-primary mt-2 disabled:opacity-50" disabled={busy || !cur || !nw}>{busy ? "Menyimpan…" : "Simpan"}</button>
      </form>
    </Card>
  );
}

function TwoFa({ enabled, mandatory }: { enabled: boolean; mandatory: boolean }) {
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(enabled);

  async function start() {
    const d = await post("/api/me/2fa/setup");
    if (d.ok) setSetup({ qr: d.qr, secret: d.secret });
    else setMsg("Gagal memulai. Coba lagi.");
  }
  async function enable(e: React.FormEvent) {
    e.preventDefault();
    const d = await post("/api/me/2fa/enable", { code });
    if (d.ok) {
      setCodes(d.backupCodes);
      setSetup(null);
      setOn(true);
      setCode("");
      setMsg("");
    } else setMsg("Kode salah. Pastikan jam perangkat akurat lalu coba lagi.");
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    const d = await post("/api/me/2fa/disable", { password: pw, code });
    if (d.ok) {
      setOn(false);
      setPw("");
      setCode("");
      setMsg("2FA dinonaktifkan.");
    } else setMsg(d.message ?? "Gagal menonaktifkan. Periksa sandi dan kode.");
  }

  return (
    <Card title="Autentikasi dua langkah (2FA)" id="2fa">
      {mandatory && !on && <p className="mb-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">Peran Anda wajib mengaktifkan 2FA sebelum menggunakan dashboard.</p>}
      {codes ? (
        <div>
          <p className="text-sm">2FA aktif. Simpan kode cadangan ini sekarang. Masing-masing hanya berlaku sekali dan tidak akan ditampilkan lagi.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
            {codes.map((c) => (
              <li key={c} className="rounded-lg border border-line px-3 py-2 text-center">{c}</li>
            ))}
          </ul>
          <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Sudah saya simpan</button>
        </div>
      ) : setup ? (
        <form onSubmit={enable} className="grid gap-5 sm:grid-cols-[auto_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code untuk aplikasi authenticator" width={176} height={176} className="rounded-xl bg-white p-2" />
          <div>
            <p className="text-sm">Pindai dengan Google Authenticator, Authy, atau 1Password. Atau masukkan kunci manual:</p>
            <p className="mt-1 break-all font-mono text-xs text-muted">{setup.secret}</p>
            <label className="mt-4 block text-sm font-medium" htmlFor="c">Kode 6 digit</label>
            <input id="c" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${inputCls} max-w-48 text-center font-mono text-xl tracking-[0.3em]`} />
            <Msg m={msg} />
            <button className="btn btn-primary mt-2 disabled:opacity-50" disabled={code.length !== 6}>Aktifkan</button>
          </div>
        </form>
      ) : on ? (
        <div>
          <p className="text-sm">Status: <span className="text-accent">aktif</span>. Setiap masuk memerlukan kode 6 digit.</p>
          {mandatory ? (
            <p className="mt-2 text-sm text-muted">Peran Anda mewajibkan 2FA, sehingga tidak dapat dinonaktifkan.</p>
          ) : (
            <form onSubmit={disable} className="mt-4 max-w-sm">
              <label className="text-sm font-medium" htmlFor="dpw">Kata sandi</label>
              <input id="dpw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
              <label className="mt-3 block text-sm font-medium" htmlFor="dc">Kode 6 digit</label>
              <input id="dc" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={inputCls} />
              <Msg m={msg} />
              <button className="btn btn-ghost mt-2 disabled:opacity-50" disabled={!pw || code.length !== 6}>Nonaktifkan</button>
            </form>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted">Tambahkan lapisan keamanan: kode 6 digit dari aplikasi authenticator saat masuk.</p>
          <Msg m={msg} />
          <button className="btn btn-primary mt-2" onClick={start}>Siapkan 2FA</button>
        </div>
      )}
    </Card>
  );
}

function Sessions() {
  const [list, setList] = useState<Sess[] | null>(null);
  const [err, setErr] = useState(false);
  const load = () =>
    fetch("/api/me/sessions")
      .then((r) => r.json())
      .then((d) => (d.ok ? setList(d.sessions) : setErr(true)))
      .catch(() => setErr(true));
  useEffect(() => void load(), []);
  const fmt = (t: number) => new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  return (
    <Card title="Sesi aktif">
      {err ? (
        <p className="text-sm text-red-400">Gagal memuat sesi.</p>
      ) : !list ? (
        <div className="h-16 animate-pulse rounded-xl bg-fg/5" aria-label="Memuat" />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {list.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{s.ua || "Perangkat tidak dikenal"}</span>
                  <span className="text-xs text-muted">{s.ip} · terakhir aktif {fmt(s.last)}</span>
                </span>
                {s.current && <span className="rounded-full border border-accent/40 px-2 py-0.5 text-xs text-accent">perangkat ini</span>}
              </li>
            ))}
          </ul>
          {list.length > 1 && (
            <button className="btn btn-ghost mt-3" onClick={async () => (await post("/api/me/sessions", undefined), load())}>
              Keluarkan perangkat lain
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function Profile(p: Props) {
  const [photo, setPhoto] = useState(p.photo);
  const [name, setName] = useState(p.name);
  const [msg, setMsg] = useState("");
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg("Mengunggah…");
    const fd = new FormData();
    fd.append("file", f);
    const d = await fetch("/api/me/photo", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (d.ok) (setPhoto(d.v), setMsg("Foto diperbarui."));
    else setMsg(d.message ?? "Gagal mengunggah.");
    e.target.value = "";
  }
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const d = await post("/api/me/profile", { name }).catch(() => ({ ok: false }));
    setMsg(d.ok ? "Nama disimpan." : "Gagal menyimpan nama.");
  }
  return (
    <Card title="Profil">
      <div className="flex flex-wrap items-center gap-5">
        <span className="grid size-20 place-items-center overflow-hidden rounded-full bg-accent/15 text-xl font-semibold text-accent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={`/api/files/avatar/${p.id}?v=${photo}`} alt="Foto profil" width={80} height={80} className="size-20 object-cover" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <label className="btn btn-ghost cursor-pointer">
            Ganti foto
            <input name="account-input-219" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} />
          </label>
          <p className="mt-2 text-xs text-muted">JPG, PNG, atau WebP, maksimal 3 MB. Lokasi (EXIF) dihapus otomatis.</p>
        </div>
      </div>
      <form onSubmit={saveName} className="mt-5 grid max-w-xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div><label className="text-sm font-medium" htmlFor="pname">Nama</label><input id="pname" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
        <button className="btn btn-primary disabled:opacity-50" disabled={name.trim().length < 2 || name === p.name}>Simpan</button>
      </form>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Email</dt><dd className="mt-0.5 break-all">{p.email}</dd></div>
        <div><dt className="text-muted">Peran</dt><dd className="mt-0.5 capitalize">{p.role}</dd></div>
      </dl>
      <Msg m={msg} />
    </Card>
  );
}

export default function Account(p: Props) {
  return (
    <div className="space-y-5">
      <Profile {...p} />
      <PwaCard />
      <Password mustChange={p.mustChange} />
      <TwoFa enabled={p.totpEnabled} mandatory={p.twoFaMandatory} />
      <Sessions />
    </div>
  );
}
