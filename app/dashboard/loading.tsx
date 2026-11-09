/** Shown smoothly while a dashboard subtab streams in. */
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse py-1" aria-busy="true" aria-label="Memuat dashboard">
      <div className="h-7 w-48 rounded-xl bg-fg/5" />
      <div className="h-48 w-full rounded-2xl bg-fg/5" />
    </div>
  );
}
