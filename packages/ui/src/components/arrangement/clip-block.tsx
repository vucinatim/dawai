import type { Clip } from "@dawai/core/document";
import { useEffect, useRef } from "react";
import { dawCanvasColors, setupCanvas } from "@/lib/canvas";
import { cn } from "@/lib/utils";
import { usePixelsPerBeat, useRuntimeStore } from "@/stores/runtime-store";

const CLIP_HEIGHT = 52;
const LABEL_HEIGHT = 13;

/** A clip on the timeline: name strip on top, note mini-map below. */
export function ClipBlock({ trackId, clip }: { trackId: string; clip: Clip }) {
  const pixelsPerBeat = usePixelsPerBeat();
  const isSelected = useRuntimeStore(
    (state) => state.selection.clipId === clip.id,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = Math.max(2, clip.length * pixelsPerBeat - 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const height = CLIP_HEIGHT - LABEL_HEIGHT;
    const context = setupCanvas(canvas, width, height);
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (clip.notes.length === 0) return;

    const pitches = clip.notes.map((note) => note[1]);
    const lowest = Math.min(...pitches);
    const highest = Math.max(...pitches);
    const range = Math.max(highest - lowest + 1, 8);
    const noteHeight = Math.max(1.5, Math.min(3, (height - 4) / range));

    context.fillStyle = dawCanvasColors().note;
    for (const [start, pitch, length, velocity] of clip.notes) {
      const x = (start / clip.length) * width;
      const noteWidth = Math.max(1, (length / clip.length) * width - 0.5);
      const y = 2 + ((highest - pitch) / range) * (height - 4);
      context.globalAlpha = 0.35 + (velocity / 127) * 0.65;
      context.fillRect(x, y, noteWidth, noteHeight);
    }
    context.globalAlpha = 1;
  }, [clip, width]);

  return (
    <button
      type="button"
      className={cn(
        "absolute top-0 overflow-hidden rounded-xs border border-daw-clip-border bg-daw-clip text-left",
        isSelected && "border-daw-accent ring-1 ring-daw-accent",
      )}
      style={{ left: clip.start * pixelsPerBeat, width, height: CLIP_HEIGHT }}
      onClick={(event) => {
        event.stopPropagation();
        useRuntimeStore.getState().actions.selectClip(trackId, clip.id);
      }}
    >
      <span className="block h-[13px] truncate bg-black/20 px-1 text-[9px] leading-[13px] text-foreground/80">
        {clip.id}
      </span>
      <canvas ref={canvasRef} />
    </button>
  );
}
