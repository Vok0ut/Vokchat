"use client";

import { useCallback, useRef, useState } from "react";

const BANDS = 5;

/**
 * Captura el micrófono (getUserMedia) y expone niveles de audio en vivo (0-1, por
 * banda) para el visualizador del composer mientras se graba. Independiente del
 * reconocimiento de voz (useSpeechRecognition) — se ejecutan en paralelo: uno
 * transcribe, este solo mide volumen para la animación.
 */
export function useAudioLevel() {
  const [levels, setLevels] = useState<number[]>(new Array(BANDS).fill(0));
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLevels(new Array(BANDS).fill(0));
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / BANDS) || 1;
        const bands = Array.from({ length: BANDS }, (_, i) => {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
          return sum / step / 255;
        });
        setLevels(bands);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch {
      return false;
    }
  }, []);

  return { levels, start, stop };
}
