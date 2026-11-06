"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFER = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Microphone dictation: records, posts the audio to /api/ai/transcribe (never stored) and hands the transcript to `onText`. */
export function useDictate(onText: (t: string) => void) {
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mr = useRef<MediaRecorder | null>(null);
  const cb = useRef(onText);
  useEffect(() => { cb.current = onText; }, [onText]);
  useEffect(() => () => { if (mr.current?.state === "recording") mr.current.stop(); }, []);

  const start = useCallback(async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setErr("Browser ini tidak mendukung perekaman suara.");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return setErr("Mikrofon tidak bisa diakses. Izinkan mikrofon di browser (ikon gembok di address bar)."); }
    const mime = PREFER.find((m) => MediaRecorder.isTypeSupported(m));
    const rc = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rc.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rc.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setBusy(true);
      const fd = new FormData();
      fd.append("audio", new Blob(chunks, { type: rc.mimeType || mime || "audio/webm" }));
      const r = await fetch("/api/ai/transcribe", { method: "POST", body: fd }).then((x) => x.json() as Promise<{ ok: boolean; text?: string; message?: string }>).catch(() => ({ ok: false, text: "", message: "Tidak bisa menghubungi server." }));
      setBusy(false);
      if (r.ok && r.text) cb.current(r.text); else setErr(r.message ?? "Dikte gagal.");
    };
    mr.current = rc;
    rc.start();
    setRec(true);
  }, []);
  const stop = useCallback(() => { mr.current?.stop(); setRec(false); }, []);
  return { rec, busy, err, toggle: () => (rec ? stop() : void start()) };
}
