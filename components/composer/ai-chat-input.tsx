"use client";

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowUp, Code2, ImageIcon, Mic, Plus, Sparkles, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { MODEL_CATEGORIES } from "@/lib/models-catalog";
import type { CatalogModel, ModelCategory } from "@/lib/types";

// ----------------------------------------------------------------------
// Transition Physics (mismo timing que la referencia original)
// ----------------------------------------------------------------------
const SPRING_TRANSITION =
  "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
const SMOOTH_HEIGHT_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out";

const CATEGORY_ICON: Record<ModelCategory, typeof Code2> = {
  codigo: Code2,
  razonamiento: Sparkles,
  imagen: ImageIcon,
};

const TEMPERATURE_LEVELS: { label: string; value: number }[] = [
  { label: "Preciso", value: 0.2 },
  { label: "Equilibrado", value: 0.6 },
  { label: "Creativo", value: 1.0 },
];

function closestTemperatureIndex(t: number): number {
  let best = 0;
  let bestDist = Infinity;
  TEMPERATURE_LEVELS.forEach((lvl, i) => {
    const d = Math.abs(lvl.value - t);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

interface Attachment {
  id: string;
  file: File;
  url: string;
  name: string;
  width?: number;
  height?: number;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
function MorphingText({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto");
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) setWidth(spanRef.current.offsetWidth);
  }, [text]);

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
      style={{ width }}
    >
      <span ref={spanRef} className="invisible whitespace-nowrap px-1">
        {text}
      </span>
      <span key={text} className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-in fade-in zoom-in-95 duration-300">
        {text}
      </span>
    </span>
  );
}

function DynamicBarsIcon({ level }: { level: number }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={1} />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={level >= 1 ? 1 : 0.3} />
      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={level >= 2 ? 1 : 0.3} />
    </svg>
  );
}

function AttachmentThumb({
  attachment,
  index,
  onRemove,
  onOpen,
  registerRef,
}: {
  attachment: Attachment;
  index: number;
  onRemove: (id: string) => void;
  onOpen: (attachment: Attachment, rect: DOMRect) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={(el) => {
        btnRef.current = el;
        registerRef(attachment.id, el);
      }}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (btnRef.current) onOpen(attachment, btnRef.current.getBoundingClientRect());
      }}
      style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards" }}
      className={cn(
        "group relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted outline-none",
        "transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-[1.04] active:scale-[0.96]",
        "animate-in fade-in slide-in-from-top-3 zoom-in-90 duration-400",
      )}
      aria-label={`Ver adjunto ${attachment.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />
      <span className={cn("absolute inset-0 flex items-start justify-end bg-black/0 transition-colors duration-200", isHovered && "bg-black/25")}>
        <span
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); onRemove(attachment.id); }}
          className={cn(
            "m-1 flex size-4 items-center justify-center rounded-full bg-background/90 text-foreground/70 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-background hover:text-foreground hover:scale-110",
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none",
          )}
          aria-label={`Quitar ${attachment.name}`}
        >
          <X className="size-2.5" />
        </span>
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------
export interface PromptInputProps {
  catalog: CatalogModel[];
  activeModelId: string;
  onModelChange: (modelId: string) => void;
  temperature: number;
  onTemperatureChange: (t: number) => void;
  busy: boolean;
  onSubmit: (value: string, images?: string[]) => void;
  onStop: () => void;
  placeholder?: string;
  className?: string;
  maxAttachments?: number;
}

export function PromptInput({
  catalog,
  activeModelId,
  onModelChange,
  temperature,
  onTemperatureChange,
  busy,
  onSubmit,
  onStop,
  placeholder = "Escribe un mensaje…",
  className,
  maxAttachments = 6,
}: PromptInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSmoothResize, setIsSmoothResize] = useState(false);
  const [value, setValue] = useState("");
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeAttachment, setActiveAttachment] = useState<{ attachment: Attachment; rect: DOMRect } | null>(null);
  const [containerHeight, setContainerHeight] = useState(116);
  const [textareaHeight, setTextareaHeight] = useState(68);
  const [isScrolling, setIsScrolling] = useState(false);
  const [hoverStyle, setHoverStyle] = useState({ opacity: 0, transform: "translateY(0px) scale(0.95)", transition: "none" });

  const activeModel = catalog.find((m) => m.modelId === activeModelId);
  const temperatureLevel = closestTemperatureIndex(temperature);

  const hasValue = value.trim() !== "" || attachments.length > 0;
  const hasAttachments = attachments.length > 0;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const topFadeRef = useRef<HTMLDivElement>(null);
  const bottomFadeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const handleValueChange = useCallback((val: string) => {
    setIsSmoothResize(true);
    setValue(val);
  }, []);

  const speech = useSpeechRecognition(handleValueChange);
  const audioLevel = useAudioLevel();
  const isRecording = speech.isListening;

  const updateFades = () => {
    const el = textareaRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (topFadeRef.current) topFadeRef.current.style.opacity = Math.min(scrollTop / 20, 1).toString();
    if (bottomFadeRef.current) {
      const bottomScroll = scrollHeight - clientHeight - scrollTop;
      bottomFadeRef.current.style.opacity = Math.min(Math.max(bottomScroll - 16, 0) / 10, 1).toString();
    }
  };

  const expand = () => {
    setIsSmoothResize(false);
    setExpanded(true);
  };

  const startRecording = useCallback(async () => {
    if (!speech.isSupported) return;
    setIsSmoothResize(false);
    setExpanded(true);
    await audioLevel.start();
    speech.start(value);
  }, [speech, audioLevel, value]);

  const stopRecording = useCallback(() => {
    speech.stop();
    audioLevel.stop();
  }, [speech, audioLevel]);

  useEffect(() => {
    if (isRecording && textareaRef.current) textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
  }, [value, isRecording]);

  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((value.trim() !== "" || hasAttachments) && !expanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSmoothResize(false);
      setExpanded(true);
    }
  }, [value, expanded, hasAttachments]);

  useEffect(() => {
    if (expanded && !isRecording) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [expanded, isRecording]);

  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const currentHeight = el.style.height;
    el.style.transition = "none";
    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;
    el.style.height = currentHeight;
    void el.offsetHeight;
    el.style.transition = "";
    const newHeight = Math.max(68, Math.min(scrollHeight, 160));
    el.style.height = `${newHeight}px`;
    setTextareaHeight(newHeight);
    setIsScrolling(scrollHeight > 160);
    setTimeout(updateFades, 0);
  }, [value, expanded]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainerHeight(Math.max(116, textareaHeight + 48));
    setTimeout(updateFades, 0);
  }, [textareaHeight]);

  useEffect(() => {
    if (!isModelSelectOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (internalContainerRef.current && !internalContainerRef.current.contains(e.target as Node)) {
        setIsModelSelectOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isModelSelectOpen]);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (internalContainerRef.current && internalContainerRef.current.contains(e.relatedTarget as Node)) return;
    if (value.trim() === "" && !hasAttachments && !isRecording) {
      setIsSmoothResize(false);
      setExpanded(false);
      setIsModelSelectOpen(false);
    }
  };

  const handleSubmit = async () => {
    if (value.trim() === "" && !hasAttachments) return;
    if (busy) return;
    setIsSmoothResize(false);
    const images = await Promise.all(attachments.map((a) => fileToDataUrl(a.file)));
    onSubmit(value, images.length ? images : undefined);
    setValue("");
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setExpanded(false);
    setIsModelSelectOpen(false);
  };

  const cycleTemperature = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (temperatureLevel + 1) % TEMPERATURE_LEVELS.length;
    onTemperatureChange(TEMPERATURE_LEVELS[next].value);
  };

  const openFileChooser = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const addAttachment = (file: File, url: string, width: number, height: number) => {
    const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
    setAttachments((prev) => [...prev, { id, file, url, name: file.name, width, height }]);
  };

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (files.length === 0) return;
    const room = Math.max(0, maxAttachments - attachments.length);
    const accepted = files.slice(0, room);
    if (!expanded) {
      setIsSmoothResize(false);
      setExpanded(true);
    } else {
      setIsSmoothResize(true);
    }
    for (const file of accepted) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => addAttachment(file, url, img.naturalWidth, img.naturalHeight);
      img.onerror = () => addAttachment(file, url, 800, 600);
      img.src = url;
    }
  };

  const removeAttachment = (id: string) => {
    setIsSmoothResize(true);
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
    thumbRefs.current.delete(id);
  };

  const showArrow = hasValue && !isRecording && !busy;
  const showStop = isRecording || busy;
  const showMic = !hasValue && !isRecording && !busy;

  const onActionButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (busy) onStop();
    else if (isRecording) stopRecording();
    else if (hasValue) handleSubmit();
    else startRecording();
  };

  return (
    <>
      <div
        ref={internalContainerRef}
        onBlur={handleBlur}
        className={cn("relative flex w-full flex-col", className)}
        style={{
          maxWidth: expanded ? 480 : 320,
          transition: isSmoothResize ? "max-width 0.15s ease-out" : "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesChosen} className="hidden" tabIndex={-1} aria-hidden="true" />

        <div
          aria-hidden={!hasAttachments}
          style={{
            height: hasAttachments && expanded ? 68 : 0,
            transition: isSmoothResize ? "height 0.15s ease-out" : "height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
          className="relative z-0 w-full overflow-hidden"
        >
          <div
            style={{
              position: "absolute",
              bottom: -8,
              left: 20,
              right: 20,
              height: 68,
              transform: hasAttachments && expanded ? "translateY(0)" : "translateY(100%)",
              opacity: hasAttachments && expanded ? 1 : 0,
              transition: isSmoothResize
                ? "transform 0.15s ease-out, opacity 0.15s ease-out"
                : "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out",
            }}
            className="prompt-scrollbar flex items-start gap-2 overflow-x-auto rounded-t-2xl border border-b-0 border-border bg-muted px-2 pt-2 pb-1"
          >
            {attachments.map((attachment, index) => (
              <AttachmentThumb
                key={attachment.id}
                attachment={attachment}
                index={index}
                onRemove={removeAttachment}
                onOpen={(a, rect) => setActiveAttachment({ attachment: a, rect })}
                registerRef={(id, el) => thumbRefs.current.set(id, el)}
              />
            ))}
          </div>
        </div>

        <div
          onMouseDown={(e) => {
            const isTextarea = e.target === textareaRef.current;
            if (expanded && !isTextarea && !isRecording) {
              e.preventDefault();
              textareaRef.current?.focus();
            }
          }}
          style={{
            borderRadius: 24,
            height: expanded ? containerHeight : 48,
            transition: isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION,
            overflow: expanded ? "visible" : "hidden",
          }}
          className={cn(
            "relative z-10 w-full border border-border bg-card shadow-sm hover:border-border/80 focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20",
            expanded ? "cursor-text" : "cursor-default",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onScroll={updateFades}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape" && value.trim() === "" && !hasAttachments) {
                setIsSmoothResize(false);
                setExpanded(false);
                setIsModelSelectOpen(false);
              }
            }}
            placeholder={placeholder}
            aria-label="Mensaje"
            disabled={isRecording}
            style={{
              transition: isSmoothResize
                ? "height 0.15s ease-out"
                : "opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
            className={cn(
              "prompt-scrollbar absolute inset-x-0 top-0 z-[1] w-full resize-none bg-transparent py-3.5 pr-12 pl-4 text-sm leading-[22px] text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/80",
              expanded ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0",
              isScrolling ? "overflow-y-auto" : "overflow-y-hidden",
              isRecording && "pointer-events-none",
            )}
          />

          <div ref={topFadeRef} className="pointer-events-none absolute top-0 right-12 left-4 z-[2] h-8 bg-gradient-to-b from-card via-card/90 to-transparent" />
          <div
            ref={bottomFadeRef}
            className="pointer-events-none absolute right-12 left-4 z-[2] h-8 bg-gradient-to-t from-card via-card/90 to-transparent"
            style={{ opacity: 0, top: `${textareaHeight - 32}px`, transition: isSmoothResize ? "top 0.15s ease-out" : "top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
          />

          <button
            type="button"
            onClick={expand}
            style={{ transition: isSmoothResize ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
            className={cn(
              "absolute inset-x-0 top-0 z-[1] cursor-text py-[15px] pr-12 pl-4 text-left text-sm font-medium leading-[17px] text-muted-foreground/80 outline-none",
              !expanded ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-105 opacity-0",
            )}
            aria-label="Abrir el campo de mensaje"
          >
            {placeholder}
          </button>

          <div
            className={cn(
              "absolute bottom-2 left-3 right-12 z-10 flex items-center gap-0 transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
              expanded && !isRecording ? "pointer-events-auto translate-y-0 opacity-100 blur-none" : "pointer-events-none translate-y-2 opacity-0 blur-sm",
            )}
          >
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); setIsModelSelectOpen((prev) => !prev); }}
                className={cn(
                  "group flex items-center gap-1 rounded-full px-2 py-1 text-foreground/50 transition-all duration-200 outline-none hover:bg-accent/60 hover:text-foreground",
                  isModelSelectOpen && "bg-accent/60 text-foreground",
                )}
                aria-label={`Elegir modelo. Actual: ${activeModel?.name || activeModelId}`}
              >
                {(() => {
                  const Icon = activeModel ? CATEGORY_ICON[activeModel.category] : Sparkles;
                  return <Icon className="size-3.5 opacity-70 transition-opacity group-hover:opacity-100" />;
                })()}
                <span className="text-xs font-semibold select-none transition-colors">
                  <MorphingText text={activeModel?.name || activeModelId || "Sin modelo"} />
                </span>
              </button>

              <div
                style={{ transformOrigin: "bottom left" }}
                onMouseLeave={() => setHoverStyle((prev) => ({ ...prev, opacity: 0, transition: "opacity 0.2s ease-in, transform 0.2s ease-out" }))}
                className={cn(
                  "absolute bottom-full left-0 z-50 mb-2.5 flex w-56 cursor-default flex-col gap-0.5 rounded-2xl border border-border bg-card/95 p-1 shadow-xl backdrop-blur-md transition-all duration-400",
                  isModelSelectOpen
                    ? "pointer-events-auto translate-y-0 scale-100 opacity-100 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                    : "pointer-events-none translate-y-3 scale-95 opacity-0 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                )}
              >
                <div className="relative flex flex-col gap-0.5">
                  <div style={hoverStyle} className="pointer-events-none absolute top-0 left-0 right-0 -z-10 h-9 rounded-xl bg-accent" />
                  {catalog.length === 0 && (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">Catálogo vacío — añade modelos en Ajustes.</div>
                  )}
                  {catalog.map((m, idx) => {
                    const Icon = CATEGORY_ICON[m.category];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() =>
                          setHoverStyle((prev) => ({
                            opacity: 1,
                            transform: `translateY(${idx * 36}px) scale(1)`,
                            transition: prev.opacity === 0 ? "opacity 0.15s ease-out" : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease",
                          }))
                        }
                        onClick={(e) => { e.stopPropagation(); onModelChange(m.modelId); setIsModelSelectOpen(false); }}
                        className="group relative flex h-9 w-full flex-col items-start justify-center gap-0 rounded-xl px-2.5 py-1 text-left outline-none active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                          <Icon className="size-3.5 opacity-85 transition-opacity group-hover:opacity-100" />
                          {m.name}
                        </span>
                        <span className="pl-5.5 text-[10px] text-muted-foreground">{MODEL_CATEGORIES[m.category]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cycleTemperature}
              className="group flex items-center gap-1 rounded-full px-2 py-1 text-foreground/50 outline-none transition-all duration-200 hover:bg-accent/60 hover:text-foreground"
              aria-label="Nivel de creatividad (temperature)"
            >
              <DynamicBarsIcon level={temperatureLevel} />
              <span className="text-xs font-semibold select-none transition-colors">
                <MorphingText text={TEMPERATURE_LEVELS[temperatureLevel].label} />
              </span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openFileChooser}
              disabled={attachments.length >= maxAttachments}
              className="ml-auto flex size-7 items-center justify-center rounded-full text-foreground/50 outline-none transition-all duration-200 hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              aria-label="Adjuntar imagen"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          <div
            className={cn(
              "absolute bottom-2 right-12 z-10 flex h-8 items-center justify-end gap-[3px] transition-all duration-400 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
              isRecording ? "w-16 translate-x-0 opacity-100" : "w-0 translate-x-4 opacity-0 pointer-events-none",
            )}
          >
            {audioLevel.levels.map((v, i) => (
              <div key={i} className="w-1 rounded-full bg-primary transition-[height] duration-75 ease-out" style={{ height: `${Math.max(4, v * 24)}px` }} />
            ))}
          </div>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={onActionButtonClick}
            disabled={showMic && !speech.isSupported}
            title={showMic && !speech.isSupported ? "Entrada de voz no soportada en este navegador" : undefined}
            aria-label={showArrow ? "Enviar" : showStop ? (busy ? "Detener generación" : "Detener grabación") : "Entrada de voz"}
            style={{ borderRadius: 9999 }}
            className="absolute right-2 bottom-2 z-10 flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground outline-none transition-all duration-300 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="relative flex h-full w-full items-center justify-center">
              <span className={cn("absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]", showArrow ? "rotate-0 scale-100 opacity-100 blur-none" : "pointer-events-none rotate-45 scale-50 opacity-0 blur-[1px]")}>
                <ArrowUp className="size-3.5" />
              </span>
              <span className={cn("absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]", showMic ? "rotate-0 scale-100 opacity-100 blur-none" : "pointer-events-none -rotate-45 scale-50 opacity-0 blur-[1px]")}>
                <Mic className="size-3.5" />
              </span>
              <span className={cn("absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]", showStop ? "rotate-0 scale-100 opacity-100 blur-none" : "pointer-events-none rotate-45 scale-50 opacity-0 blur-[1px]")}>
                <Square className="size-3 fill-current" />
              </span>
            </span>
          </button>
        </div>
      </div>

      {activeAttachment && (
        <AttachmentGalleryModal attachment={activeAttachment.attachment} originRect={activeAttachment.rect} onClose={() => setActiveAttachment(null)} />
      )}
    </>
  );
}

// ----------------------------------------------------------------------
// Shared-Element Gallery Modal
// ----------------------------------------------------------------------
function AttachmentGalleryModal({
  attachment,
  originRect,
  onClose,
}: {
  attachment: Attachment;
  originRect: DOMRect;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [targetRect, setTargetRect] = useState<{ top: number; left: number; width: number; height: number; radius: number } | null>(null);

  useEffect(() => {
    const maxW = Math.min(window.innerWidth * 0.86, 560);
    const maxH = Math.min(window.innerHeight * 0.78, 720);
    const naturalW = attachment.width || 800;
    const naturalH = attachment.height || 600;
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.6);
    const width = naturalW * scale;
    const height = naturalH * scale;
    // Depende de window.innerWidth/innerHeight (sistema externo), no se puede calcular
    // durante el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetRect({ top: (window.innerHeight - height) / 2, left: (window.innerWidth - width) / 2, width, height, radius: 20 });
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, [attachment]);

  const handleClose = useCallback(() => setPhase("closing"), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const isOpen = phase === "open";
  const isClosing = phase === "closing";
  const geometry =
    isOpen && targetRect ? targetRect : { top: originRect.top, left: originRect.left, width: originRect.width, height: originRect.height, radius: 12 };
  const animEasing = isClosing ? "ease-out" : "cubic-bezier(0.175, 0.885, 0.32, 1.275)";
  const animDur = isClosing ? "0.3s" : "0.45s";
  const flipTransition = `top ${animDur} ${animEasing}, left ${animDur} ${animEasing}, width ${animDur} ${animEasing}, height ${animDur} ${animEasing}, border-radius ${animDur} ${animEasing}`;

  return (
    <div className="fixed inset-0 z-[100]" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md transition-opacity duration-400" style={{ opacity: isOpen ? 1 : 0 }} />
      <div
        style={{
          position: "fixed",
          top: geometry.top,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          borderRadius: geometry.radius,
          transition: flipTransition,
          overflow: "hidden",
          boxShadow: isOpen ? "0 24px 60px -12px rgb(0 0 0 / 0.35)" : "0 0px 0px 0px rgb(0 0 0 / 0)",
        }}
        className="bg-muted"
        onTransitionEnd={() => { if (phase === "closing") onClose(); }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />
      </div>

      <button
        type="button"
        onClick={handleClose}
        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "scale(1)" : "scale(0.7)" }}
        className={cn(
          "fixed right-4 top-4 flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground/70 shadow-md backdrop-blur-sm",
          "transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-card hover:text-foreground",
          !isOpen && "pointer-events-none",
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
