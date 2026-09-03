"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Envoltorio real sobre la Web Speech API (SpeechRecognition/webkitSpeechRecognition).
 * A diferencia del componente de referencia pegado por el usuario, esto NO tiene un
 * fallback de texto simulado — si el navegador no soporta la API, `isSupported` es
 * false y la UI debe mostrar un estado deshabilitado en vez de fingir una transcripción.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtorType = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtorType | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtorType;
    webkitSpeechRecognition?: SpeechRecognitionCtorType;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baselineRef = useRef("");

  useEffect(() => {
    // Detecta soporte del navegador tras el primer render (API solo existe en window).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(!!getSpeechRecognitionCtor());
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const start = useCallback(
    (currentText: string) => {
      const SpeechRecognitionCtor = getSpeechRecognitionCtor();
      if (!SpeechRecognitionCtor) return;

      baselineRef.current = currentText;
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = typeof navigator !== "undefined" ? navigator.language : "es-ES";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (final) baselineRef.current += (baselineRef.current ? " " : "") + final;
        onResult((baselineRef.current + (interim ? " " + interim : "")).trim());
      };
      recognition.onerror = () => stop();
      recognition.onend = () => stop();

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    },
    [onResult, stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { isSupported, isListening, start, stop };
}
