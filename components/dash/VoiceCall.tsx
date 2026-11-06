"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Headphones,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  MessageSquareText,
  Radio,
  SendHorizontal,
} from "lucide-react";
import { api } from "./kit";

type Turn = { role: "user" | "assistant"; content: string; time: string };
type CallState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

const STORAGE_KEY = "estaka.bicara.v1";
const SUGGESTIONS = [
  "Halo! Apa saja layanan unggulan di Estaka Dental Clinic?",
  "Bisa jelaskan kenapa gusi saya sering berdarah saat sikat gigi?",
  "Berapa lama proses pemasangan behel dan cara perawatannya?",
  "Apakah penambalan gigi berlubang itu sakit?",
  "Ayo ngobrol santai seputar teknologi modern kedokteran gigi.",
];

// Helper to format call duration seconds to MM:SS
function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceCall({ role = "pasien" }: { role?: string }) {
  const [state, setState] = useState<CallState>("idle");
  const [duration, setDuration] = useState(0);
  const [history, setHistory] = useState<Turn[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [currentAiSpeech, setCurrentAiSpeech] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [customText, setCustomText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // References
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const isCallActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  const isAudioMutedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const synthVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize mutable refs
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  // Load voices on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Look for Indonesian voice first
      const idVoice = voices.find(
        (v) => v.lang.toLowerCase().startsWith("id") || v.lang.toLowerCase().includes("indonesia")
      );
      synthVoiceRef.current = idVoice || voices[0] || null;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;

    // Restore cached history if present
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Save history to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30)));
    } catch {}
  }, [history]);

  // Stop active speech synthesis
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
  }, []);

  // Speak AI answer with sentence chunking
  const speakText = useCallback(
    (fullText: string, onFinish?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || isAudioMutedRef.current) {
        onFinish?.();
        return;
      }
      stopSpeaking();
      isSpeakingRef.current = true;
      setCurrentAiSpeech(fullText);

      // Clean text from Markdown artifacts (like * or #) for cleaner TTS
      const clean = fullText
        .replace(/[*#_~`>]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();

      // Split into sentences (by . ! ? or linebreaks)
      const sentences = clean
        .split(/(?<=[.!?\n])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (sentences.length === 0) {
        isSpeakingRef.current = false;
        onFinish?.();
        return;
      }

      speechQueueRef.current = [...sentences];

      const playNext = () => {
        if (!isCallActiveRef.current) {
          isSpeakingRef.current = false;
          return;
        }
        if (speechQueueRef.current.length === 0) {
          isSpeakingRef.current = false;
          onFinish?.();
          return;
        }

        const sentence = speechQueueRef.current.shift()!;
        const utter = new SpeechSynthesisUtterance(sentence);
        if (synthVoiceRef.current) utter.voice = synthVoiceRef.current;
        utter.lang = synthVoiceRef.current?.lang || "id-ID";
        utter.rate = 1.05;
        utter.pitch = 1.0;

        utter.onend = () => {
          if (isCallActiveRef.current && isSpeakingRef.current) {
            playNext();
          }
        };

        utter.onerror = (e) => {
          console.warn("[TTS] Utterance error:", e);
          if (isCallActiveRef.current && isSpeakingRef.current) {
            playNext();
          }
        };

        window.speechSynthesis.speak(utter);
      };

      playNext();
    },
    [stopSpeaking]
  );

  // Send question to AI backend (/api/ai/voice)
  const submitQuestion = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || !isCallActiveRef.current) return;

      stopSpeaking();
      setState("thinking");
      setLiveTranscript("");
      setErrorNotice(null);

      const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const currentHistory = [...history];

      // Optimistically add user turn
      setHistory((prev) => [...prev, { role: "user", content: q, time }]);

      // Send to 9Router Voice AI tool
      const payloadHistory = currentHistory.slice(-8).map((h) => ({ role: h.role, content: h.content }));
      const res = await api<{ text: string }>("/api/ai/voice", "POST", {
        question: q,
        history: payloadHistory,
      });

      if (!isCallActiveRef.current) return;

      if (!res.ok || !res.text) {
        setErrorNotice(res.message || "Gagal mendapatkan balasan dari AI. Silakan ulangi ucapan Anda.");
        setState("listening");
        resumeListening();
        return;
      }

      const answer = res.text.trim();
      const aiTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      setHistory((prev) => [...prev, { role: "assistant", content: answer, time: aiTime }]);

      setState("speaking");
      speakText(answer, () => {
        if (isCallActiveRef.current) {
          setState("listening");
          resumeListening();
        }
      });
    },
    [history, speakText, stopSpeaking]
  );

  // Resume Web Speech Recognition
  const resumeListening = useCallback(() => {
    if (!isCallActiveRef.current || isMutedRef.current) return;
    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        setTimeout(() => {
          if (isCallActiveRef.current && !isMutedRef.current) {
            try {
              recognitionRef.current.start();
            } catch {}
          }
        }, 150);
      }
    } catch {}
  }, []);

  // Setup Web Speech Recognition API
  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser; fallback available.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "id-ID";
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (isCallActiveRef.current && state !== "thinking" && state !== "speaking") {
        setState("listening");
      }
    };

    rec.onresult = (event: any) => {
      if (!isCallActiveRef.current || isMutedRef.current) return;

      // If user starts speaking while AI is speaking, interrupt immediately!
      if (isSpeakingRef.current) {
        stopSpeaking();
        setState("listening");
      }

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const currentSpeech = final || interim;
      setLiveTranscript(currentSpeech);

      // Debounce silence detection: once user stops talking for 1200ms, send to AI
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (currentSpeech.trim().length > 1) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (isCallActiveRef.current && currentSpeech.trim().length > 1) {
            submitQuestion(currentSpeech.trim());
          }
        }, 1300);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      console.warn("[SpeechRecognition error]", e.error);
    };

    rec.onend = () => {
      // Auto restart if call is still active and not thinking/speaking
      if (isCallActiveRef.current && !isMutedRef.current && state === "listening") {
        try {
          rec.start();
        } catch {}
      }
    };

    return rec;
  }, [state, stopSpeaking, submitQuestion]);

  // Start Call Handler
  const startCall = async () => {
    setErrorNotice(null);
    setState("connecting");
    setDuration(0);

    // Request microphone permission and initialize audio visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Web Audio API for audio level metering
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);
        const analyzer = ctx.createAnalyser();
        analyzer.fftSize = 64;
        source.connect(analyzer);
        audioContextRef.current = ctx;

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        const checkLevel = () => {
          if (!isCallActiveRef.current) return;
          analyzer.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round(avg * 1.5)));
          requestAnimationFrame(checkLevel);
        };
        requestAnimationFrame(checkLevel);
      } catch (e) {
        console.warn("Audio meter init failed:", e);
      }

      isCallActiveRef.current = true;

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Initialize Speech Recognition
      const rec = setupSpeechRecognition();
      if (rec) {
        recognitionRef.current = rec;
        try {
          rec.start();
        } catch {}
      }

      setState("listening");

      // Warm greeting on first start if history is empty
      if (history.length === 0) {
        const greeting =
          "Halo! Saya Estaka Voice AI. Silakan tanyakan apa saja atau mulai obrolan santai, saya siap mendengarkan.";
        const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        setHistory([{ role: "assistant", content: greeting, time }]);
        setState("speaking");
        speakText(greeting, () => {
          if (isCallActiveRef.current) {
            setState("listening");
            resumeListening();
          }
        });
      }
    } catch (err: any) {
      console.error("Mic access error:", err);
      setState("idle");
      setErrorNotice("Tidak dapat mengakses mikrofon. Izinkan akses mikrofon di pengaturan browser Anda.");
    }
  };

  // End Call Handler
  const endCall = useCallback(() => {
    isCallActiveRef.current = false;
    stopSpeaking();

    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setState("idle");
    setLiveTranscript("");
    setCurrentAiSpeech("");
    setAudioLevel(0);
  }, [stopSpeaking]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  // Manual interrupt: user clicks "Potong / Bicara"
  const handleInterrupt = () => {
    stopSpeaking();
    setState("listening");
    resumeListening();
  };

  // Clear conversation history
  const handleClearHistory = () => {
    setHistory([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Manual send from text input inside voice mode
  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    const txt = customText.trim();
    setCustomText("");
    submitQuestion(txt);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between gap-3 border-b border-line/60 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/portal/tanya"
            onClick={() => endCall()}
            aria-label="Kembali ke Tanya Teks"
            className="grid size-10 place-items-center rounded-full border border-line text-muted transition-transform active:scale-95 hover:text-fg"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-accent/20 text-accent">
                <Radio size={14} className={state !== "idle" ? "animate-pulse text-accent" : "text-muted"} />
              </span>
              <h1 className="display text-xl font-semibold leading-tight">Telepon AI Estaka</h1>
            </div>
            <p className="text-xs text-muted">
              {state === "idle"
                ? "Panggilan suara langsung bebas topik"
                : `Panggilan berlangsung · ${fmtDuration(duration)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={() => setShowDrawer((v) => !v)}
              aria-label="Lihat transkrip teks"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-transform active:scale-95 hover:text-fg"
            >
              <MessageSquareText size={15} />
              <span>Transkrip ({history.length})</span>
            </button>
          )}

          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              aria-label="Reset obrolan"
              title="Reset obrolan"
              className="grid size-9 place-items-center rounded-full border border-line text-muted transition-transform active:scale-95 hover:text-fg"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Error alert if any */}
      {errorNotice && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-4 py-3 text-sm text-[var(--bad)]"
        >
          {errorNotice}
        </div>
      )}

      {/* Main Interactive Call Stage */}
      <div className="relative mt-6 flex min-h-[50dvh] flex-col items-center justify-center rounded-3xl border border-line/70 bg-gradient-to-b from-card/60 via-card/30 to-transparent p-6 text-center shadow-inner overflow-hidden">
        {/* Ambient Aurora Glow Background */}
        <div
          className={`absolute -top-24 size-72 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none ${
            state === "listening"
              ? "bg-emerald-500/15"
              : state === "speaking"
              ? "bg-accent/25"
              : state === "thinking"
              ? "bg-violet-500/20 animate-pulse"
              : "bg-transparent opacity-0"
          }`}
        />

        {/* Central Glowing Aurora Orb Visualizer */}
        <div className="relative flex items-center justify-center py-6">
          {/* Outer Pulsing Wave Rings */}
          {state !== "idle" && (
            <>
              <div
                className="absolute rounded-full border border-accent/20 transition-all duration-300"
                style={{
                  width: `${160 + (state === "listening" ? audioLevel * 1.2 : 40)}px`,
                  height: `${160 + (state === "listening" ? audioLevel * 1.2 : 40)}px`,
                  opacity: state === "listening" ? 0.3 + audioLevel / 200 : 0.4,
                  transform: `scale(${state === "speaking" ? 1.08 : 1})`,
                }}
              />
              <div
                className="absolute rounded-full border border-accent/10 transition-all duration-500"
                style={{
                  width: `${210 + (state === "listening" ? audioLevel * 1.8 : 70)}px`,
                  height: `${210 + (state === "listening" ? audioLevel * 1.8 : 70)}px`,
                  opacity: state === "listening" ? 0.2 + audioLevel / 300 : 0.25,
                }}
              />
            </>
          )}

          {/* Central Orb Button */}
          {state === "idle" ? (
            <button
              onClick={startCall}
              aria-label="Mulai panggilan suara"
              className="group relative grid size-32 place-items-center rounded-full bg-accent text-bg shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 rounded-full bg-accent/40 blur-md group-hover:blur-lg transition-all" />
              <Phone size={44} className="relative z-10 transition-transform group-hover:rotate-12" />
            </button>
          ) : (
            <div
              className={`relative grid size-32 place-items-center rounded-full transition-all duration-500 ${
                state === "listening"
                  ? "bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/40 shadow-emerald-500/20 shadow-lg"
                  : state === "speaking"
                  ? "bg-accent/20 text-accent border-2 border-accent/50 shadow-accent/20 shadow-lg"
                  : state === "thinking"
                  ? "bg-violet-500/20 text-violet-400 border-2 border-violet-500/40 animate-pulse shadow-lg"
                  : "bg-card border border-line text-muted"
              }`}
            >
              {state === "listening" ? (
                <Mic size={42} className="animate-bounce" />
              ) : state === "speaking" ? (
                <Volume2 size={42} className="animate-pulse" />
              ) : state === "thinking" ? (
                <Sparkles size={40} className="animate-spin" style={{ animationDuration: "3s" }} />
              ) : (
                <Radio size={40} />
              )}
            </div>
          )}
        </div>

        {/* State Label & Subtitle */}
        <div className="mt-4 max-w-md">
          {state === "idle" ? (
            <>
              <h2 className="display text-2xl font-semibold">Mulai Percakapan Suara</h2>
              <p className="mt-1 text-sm text-muted">
                Tekan tombol telepon di atas untuk berbicara langsung dengan Estaka Voice AI. Bebas tanya topik apapun.
              </p>
            </>
          ) : state === "connecting" ? (
            <>
              <h2 className="text-lg font-medium text-muted">Menghubungkan mikrofon…</h2>
              <p className="text-xs text-muted">Mohon izinkan akses mikrofon pada peramban.</p>
            </>
          ) : state === "listening" ? (
            <>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                Mendengarkan ucapan Anda…
              </div>
              <p className="mt-2 min-h-12 text-sm italic text-fg/90">
                {liveTranscript || "Silakan berbicara sekarang, AI akan langsung merespons setelah jeda sejenak."}
              </p>
            </>
          ) : state === "thinking" ? (
            <>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
                <span className="size-2 rounded-full bg-violet-400 animate-pulse" />
                Estaka AI sedang berpikir…
              </div>
              <p className="mt-2 text-sm text-muted">Merangkai jawaban terbaik untuk Anda…</p>
            </>
          ) : state === "speaking" ? (
            <>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                <Volume2 size={13} className="animate-pulse" />
                Estaka AI sedang berbicara…
              </div>
              <p className="mt-2 max-h-24 overflow-y-auto px-2 text-sm leading-relaxed text-fg/90 font-serif">
                “{currentAiSpeech}”
              </p>
              <button
                onClick={handleInterrupt}
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted hover:text-fg transition-transform active:scale-95"
              >
                <span>Potong pembicaraan & bicara</span>
              </button>
            </>
          ) : null}
        </div>

        {/* Suggestion Chips when Idle */}
        {state === "idle" && (
          <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
            <span className="w-full text-xs text-muted">Ide pertanyaan untuk dicoba saat tersambung:</span>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={async () => {
                  await startCall();
                  setTimeout(() => submitQuestion(s), 600);
                }}
                className="rounded-full border border-line bg-card/50 px-3.5 py-1.5 text-xs text-fg transition-all hover:border-accent hover:text-accent active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Active Call Controls Bottom Bar */}
        {state !== "idle" && (
          <div className="mt-8 flex items-center justify-center gap-4">
            {/* Mute Mic Toggle */}
            <button
              onClick={() => {
                setIsMuted((m) => !m);
                if (!isMuted && state === "listening") {
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.abort();
                    } catch {}
                  }
                } else if (isMuted && state === "listening") {
                  resumeListening();
                }
              }}
              title={isMuted ? "Buka Mic" : "Bisu Mic (Mute)"}
              aria-label={isMuted ? "Buka Mic" : "Bisu Mic (Mute)"}
              className={`grid size-12 place-items-center rounded-full border transition-all active:scale-95 ${
                isMuted
                  ? "border-[var(--bad)]/50 bg-[var(--bad)]/15 text-[var(--bad)]"
                  : "border-line bg-card text-muted hover:text-fg"
              }`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              title="Akhiri Panggilan"
              aria-label="Akhiri Panggilan"
              className="grid size-14 place-items-center rounded-full bg-[var(--bad)] text-white shadow-lg shadow-[var(--bad)]/30 transition-transform hover:scale-105 active:scale-95"
            >
              <PhoneOff size={24} />
            </button>

            {/* Mute Speaker Toggle */}
            <button
              onClick={() => {
                setIsAudioMuted((m) => {
                  const next = !m;
                  if (next) stopSpeaking();
                  return next;
                });
              }}
              title={isAudioMuted ? "Bunyikan Suara" : "Senyapkan Suara AI"}
              aria-label={isAudioMuted ? "Bunyikan Suara" : "Senyapkan Suara AI"}
              className={`grid size-12 place-items-center rounded-full border transition-all active:scale-95 ${
                isAudioMuted
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-500"
                  : "border-line bg-card text-muted hover:text-fg"
              }`}
            >
              {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        )}
      </div>

      {/* Manual Input Fallback Bar (Keyboard / Silent environment) */}
      {state !== "idle" && (
        <form onSubmit={handleManualSend} className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Atau ketik ucapan Anda di sini jika sedang di tempat bising…"
            className="flex-1 rounded-2xl border border-line bg-card px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            disabled={!customText.trim() || state === "thinking"}
            aria-label="Kirim teks ke panggilan"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-bg transition-transform active:scale-95 disabled:opacity-40"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      )}

      {/* Slide-over / Expandable Transcript Drawer */}
      {showDrawer && (
        <section
          aria-label="Transkrip Panggilan"
          className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <MessageSquareText size={18} className="text-accent" />
              <h3 className="font-semibold text-sm">Transkrip Lengkap Percakapan</h3>
            </div>
            <button
              onClick={() => setShowDrawer(false)}
              className="text-xs text-muted hover:text-fg underline"
            >
              Tutup
            </button>
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-center text-xs text-muted py-6">Belum ada rekaman percakapan.</p>
            ) : (
              history.map((turn, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${turn.role === "user" ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted mb-1 px-1">
                    {turn.role === "user" ? "Anda" : "Estaka AI"} · {turn.time}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      turn.role === "user"
                        ? "rounded-br-sm bg-accent text-bg"
                        : "rounded-bl-sm border border-line bg-bg text-fg font-serif"
                    }`}
                  >
                    {turn.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Footer Info Notice */}
      <footer className="mt-8 text-center text-xs text-muted">
        <p>
          Fitur Telepon AI ditenagai oleh 9Router resmi Estaka. Suara dianalisis secara privat langsung di perangkat
          Anda dan tidak disimpan ke basis data permanen.
        </p>
      </footer>
    </div>
  );
}
