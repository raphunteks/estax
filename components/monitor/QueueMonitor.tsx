"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FarmasiBoard, PoliBoard } from "@/lib/clinic/monitor";
import { MOTION_OK, gsap, useGSAP } from "@/lib/gsap";

type Kind = "poli" | "farmasi";
type Board = PoliBoard | FarmasiBoard;

/** Two short sine tones; WebAudio needs a prior user gesture, hence the "enable sound" overlay. */
function chime(ctx: AudioContext) {
  [660, 880].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.28;
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.55);
  });
}
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "id-ID"; u.rate = 0.9;
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}

export default function QueueMonitor({ kind }: { kind: Kind }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<"ok" | "offline" | "expired" | "forbidden">("ok");
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<number | null>(null);
  const soundOn = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/monitor/${kind}`, { cache: "no-store" });
      if (r.status === 401) return setState("expired");
      if (r.status === 403) return setState("forbidden");
      const d = (await r.json()) as { board: Board };
      setBoard(d.board); setState("ok");
    } catch { setState("offline"); }
  }, [kind]);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, 2500);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(t); clearInterval(c); };
  }, [poll]);

  // New or repeated call: pulse the hero number, play the chime and announce once per call.
  const last = board?.last ?? null;
  useGSAP(() => {
    if (!last) return;
    if (seen.current === null) { seen.current = last.at; return; }
    if (seen.current === last.at) return;
    seen.current = last.at;
    if (soundOn.current && audio.current) {
      chime(audio.current);
      const where = "doctor" in last ? `, silakan menuju ${last.doctor}` : ", silakan menuju loket farmasi";
      setTimeout(() => speak(`Nomor antrean ${last.no}${where}`), 700);
    }
    if (hero.current) gsap.matchMedia().add(MOTION_OK, () => {
      gsap.fromTo(hero.current, { scale: 0.94, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.6)" });
      gsap.fromTo(hero.current!.querySelector("[data-glow]"), { opacity: 0.9 }, { opacity: 0, duration: 1.6, ease: "power2.out" });
    });
  }, { dependencies: [last?.at], scope: root });

  useGSAP(() => {
    gsap.matchMedia().add(MOTION_OK, () => {
      gsap.from("[data-in]", { y: 18, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" });
    });
  }, { scope: root });

  const enable = () => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio.current = new Ctx(); soundOn.current = true; setSound(true);
    chime(audio.current);
  };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen());
  const clock = new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }).replace(".", ":");
  const day = new Date(now).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Makassar" });
  const title = kind === "poli" ? "Antrean Poliklinik" : "Antrean Farmasi";

  return (
    <div ref={root} className="relative min-h-dvh overflow-hidden bg-[#0b0b0f] text-white [font-family:var(--font-sans,system-ui)]">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[60vh] w-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(10,132,255,.28),transparent)]" />
      <header data-in className="relative flex items-center justify-between px-[4vw] pt-[3vh]">
        <div>
          <p className="text-[clamp(.8rem,1.1vw,1.1rem)] tracking-[.18em] text-white/50 uppercase">Estaka Dental Clinic</p>
          <h1 className="text-[clamp(1.6rem,3vw,3rem)] font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[clamp(1.6rem,3.4vw,3.4rem)] leading-none font-semibold tabular-nums">{clock}</p>
            <p className="text-[clamp(.7rem,1vw,1rem)] text-white/50">{day}</p>
          </div>
          <button onClick={full} className="rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur transition-[transform,background-color] hover:bg-white/20 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-white" aria-label="Layar penuh">Layar penuh</button>
        </div>
      </header>

      {state !== "ok" && (
        <p role="alert" className="relative mx-[4vw] mt-4 rounded-2xl bg-amber-400/15 px-5 py-3 text-amber-200">
          {state === "offline" && "Koneksi terputus. Mencoba menyambung kembali…"}
          {state === "expired" && <>Sesi berakhir. <a className="underline" href={`/masuk?next=/monitor-antrean-${kind === "poli" ? "poliklinik" : "farmasi"}`}>Masuk lagi</a></>}
          {state === "forbidden" && "Akun ini tidak berhak membuka monitor antrean."}
        </p>
      )}

      <main className="relative px-[4vw] pt-[3vh] pb-[4vh]">
        {!board ? <div className="h-[50vh] animate-pulse rounded-[2rem] bg-white/5" aria-label="Memuat" /> : kind === "poli" ? <Poli b={board as PoliBoard} hero={hero} /> : <Farmasi b={board as FarmasiBoard} hero={hero} />}
      </main>

      {!sound && (
        <button onClick={enable} className="fixed right-6 bottom-6 rounded-full bg-[#0a84ff] px-5 py-3 text-sm font-medium shadow-2xl transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-white">
          Ketuk untuk mengaktifkan suara panggilan
        </button>
      )}
    </div>
  );
}

const glass = "rounded-[2rem] border border-white/10 bg-white/[0.06] backdrop-blur-xl";

function Hero({ hero, no, line1, line2 }: { hero: React.RefObject<HTMLDivElement | null>; no: number | null; line1: string; line2: string }) {
  return (
    <div ref={hero} data-in className={`${glass} relative overflow-hidden p-[3vw] text-center`}>
      <div data-glow aria-hidden className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(48,209,88,.5),transparent)] opacity-0" />
      <p className="relative text-[clamp(.9rem,1.4vw,1.4rem)] tracking-[.2em] text-white/60 uppercase">Sedang dipanggil</p>
      <p aria-live="assertive" className="relative text-[clamp(5rem,16vw,15rem)] leading-none font-semibold tracking-tight tabular-nums">{no ?? <span className="text-white/20">–</span>}</p>
      <p className="relative text-[clamp(1.2rem,2.4vw,2.4rem)] font-medium">{line1}</p>
      <p className="relative text-[clamp(.9rem,1.5vw,1.5rem)] text-white/60">{line2}</p>
    </div>
  );
}

function Poli({ b, hero }: { b: PoliBoard; hero: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="grid gap-[2vw] lg:grid-cols-[1.1fr_1fr]">
      <Hero hero={hero} no={b.last?.no ?? null} line1={b.last ? b.last.doctor : "Belum ada panggilan"} line2={b.last ? b.last.name : "Mohon menunggu, nomor Anda akan dipanggil"} />
      <div className="grid content-start gap-[1.2vw]">
        {b.doctors.length === 0 && <p data-in className={`${glass} p-8 text-center text-white/60`}>Belum ada pasien dalam antrean hari ini.</p>}
        {b.doctors.map((d) => (
          <section key={d.id} data-in className={`${glass} p-[1.6vw]`} aria-label={d.name}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[clamp(1.1rem,1.8vw,1.8rem)] font-semibold">{d.name}</h2>
              <span className="text-[clamp(.8rem,1.1vw,1.1rem)] text-white/50">{d.waitingCount} menunggu</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
              <p className="text-[clamp(.9rem,1.3vw,1.3rem)]"><span className="text-white/50">Dipanggil </span><b className="text-[#30d158] tabular-nums">{d.calling ? d.calling.no : "–"}</b></p>
              <p className="text-[clamp(.9rem,1.3vw,1.3rem)]"><span className="text-white/50">Dalam perawatan </span><b className="tabular-nums">{d.inChair ? d.inChair.no : "–"}</b></p>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {d.waiting.map((w, i) => <li key={w.no} className={`rounded-full px-4 py-1.5 text-[clamp(.9rem,1.4vw,1.4rem)] tabular-nums ${i === 0 ? "bg-[#0a84ff] font-semibold" : "bg-white/10"}`}>{w.no}</li>)}
              {d.waitingCount > d.waiting.length && <li className="px-2 py-1.5 text-white/50">+{d.waitingCount - d.waiting.length}</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Farmasi({ b, hero }: { b: FarmasiBoard; hero: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="grid gap-[2vw] lg:grid-cols-[1.1fr_1fr]">
      <Hero hero={hero} no={b.last?.no ?? null} line1={b.last ? "Silakan ke loket farmasi" : "Belum ada panggilan"} line2={b.last ? b.last.name : "Obat Anda sedang disiapkan"} />
      <div className="grid content-start gap-[1.2vw]">
        <section data-in className={`${glass} p-[1.6vw]`}>
          <h2 className="text-[clamp(1.1rem,1.8vw,1.8rem)] font-semibold">Dipanggil</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {b.calling.length === 0 && <li className="text-white/50">Belum ada</li>}
            {b.calling.map((c) => <li key={c.no} className="rounded-full bg-[#30d158]/20 px-4 py-1.5 text-[clamp(.9rem,1.4vw,1.4rem)] font-semibold text-[#30d158] tabular-nums">{c.no}</li>)}
          </ul>
        </section>
        <section data-in className={`${glass} p-[1.6vw]`}>
          <div className="flex items-baseline justify-between"><h2 className="text-[clamp(1.1rem,1.8vw,1.8rem)] font-semibold">Menunggu</h2><span className="text-white/50">{b.waitingCount} resep</span></div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {b.waiting.length === 0 && <li className="text-white/50">Tidak ada antrean</li>}
            {b.waiting.map((w, i) => <li key={w.no} className={`rounded-full px-4 py-1.5 text-[clamp(.9rem,1.4vw,1.4rem)] tabular-nums ${i === 0 ? "bg-[#0a84ff] font-semibold" : "bg-white/10"}`}>{w.no}</li>)}
          </ul>
        </section>
        <p data-in className="px-2 text-white/50">Sudah diserahkan hari ini: {b.ready}</p>
      </div>
    </div>
  );
}
