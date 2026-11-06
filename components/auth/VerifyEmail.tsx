"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "./ui";

export default function VerifyEmail({ token }: { token: string }) {
  const [s, setS] = useState<"load" | "ok" | "bad">("load");
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return; // strict mode would otherwise spend the single-use token twice
    sent.current = true;
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then((d) => setS(d.ok ? "ok" : "bad"))
      .catch(() => setS("bad"));
  }, [token]);
  return (
    <AuthShell title={s === "ok" ? "Email terverifikasi" : s === "bad" ? "Tautan tidak valid" : "Memverifikasi…"} sub={s === "ok" ? "Akun pasien Anda aktif." : s === "bad" ? "Tautan kedaluwarsa atau sudah dipakai. Coba masuk untuk meminta tautan baru." : undefined}>
      {s !== "load" && <Link href="/masuk" className="btn btn-primary w-full">Ke halaman masuk</Link>}
    </AuthShell>
  );
}
