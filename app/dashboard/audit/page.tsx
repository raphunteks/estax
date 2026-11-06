import type { Metadata } from "next";
import { getAuth } from "@/lib/auth/session";
import { recentAudit } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Log audit" };

type Row = { event?: string; uid?: string | null; t?: number; ip?: string } & Record<string, unknown>;

export default async function Page() {
  const { user } = (await getAuth())!;
  const rows = (await recentAudit(user.role === "superadmin" ? undefined : user.id)) as Row[];
  return (
    <div>
      <h1 className="display text-3xl">Log audit</h1>
      <p className="mt-2 text-sm text-muted">{user.role === "superadmin" ? "Aktivitas keamanan seluruh akun (3 hari terakhir)." : "Aktivitas keamanan akun Anda."}</p>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Belum ada aktivitas tercatat.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Peristiwa</th><th className="px-4 py-3">Akun</th><th className="px-4 py-3">Detail</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{new Date(r.t ?? 0).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.event}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.uid?.slice(0, 8) ?? "-"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{[r.ip, ...Object.entries(r).filter(([k]) => !["t", "event", "uid", "ip"].includes(k)).map(([k, v]) => `${k}=${String(v)}`)].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
