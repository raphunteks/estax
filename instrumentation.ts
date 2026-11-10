export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Non-blocking single-roundtrip warmup after server socket binds:
    // warms the Upstash TLS keep-alive socket and primes `memoByRev` in 1 single `mget` call.
    setTimeout(async () => {
      try {
        const [{ db, primeMemo }, { DEFAULTS }] = await Promise.all([
          import("@/lib/db/store"),
          import("@/lib/master"),
        ]);
        const [revRaw, rules, poliklinik, paytypes, features, policy2fa, docsSched] = await db().mget<unknown>(
          "sys:rev",
          "master:rules",
          "master:poliklinik",
          "master:paytypes",
          "master:features",
          "policy:2fa",
          "cache:docs_sched",
        );
        const rev = Number(revRaw ?? 0);
        const entries: Record<string, unknown> = {
          "master:rules": rules ? { ...DEFAULTS.rules, ...(rules as object) } : DEFAULTS.rules,
          "master:poliklinik": poliklinik ?? DEFAULTS.poliklinik,
          "master:paytypes": paytypes ?? DEFAULTS.paytypes,
          "master:features": features ? { ...DEFAULTS.features, ...(features as object) } : DEFAULTS.features,
          "policy:2fa": policy2fa ?? null,
        };
        const ds = docsSched as { rev: number; data: unknown[] } | null;
        if (ds && ds.rev === rev && Array.isArray(ds.data)) {
          entries["docs:sched"] = ds.data;
        }
        primeMemo(rev, entries);
        if (!entries["docs:sched"]) {
          const { doctorsWithSchedule } = await import("@/lib/clinic/appointments");
          await doctorsWithSchedule();
        }
      } catch {
        /* ignore warmup errors when offline */
      }
    }, 10);
  }
}
