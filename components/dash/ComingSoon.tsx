import Link from "next/link";

/** Honest placeholder for modules that are planned but not built yet (shows what will be inside and which phase). */
export default function ComingSoon({ title, phase, items }: { title: string; phase: number; items: string[] }) {
  return (
    <div>
      <h1 className="display text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Modul ini dikerjakan di Fase {phase} dan belum aktif.</p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6">
        <h2 className="text-sm font-semibold">Isi modul</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {items.map((i) => (
            <li key={i} className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />{i}</li>
          ))}
        </ul>
        <Link href="/dashboard" className="btn btn-ghost mt-6 inline-flex">Kembali ke Beranda</Link>
      </div>
    </div>
  );
}
