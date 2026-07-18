import { midiToNoteName } from "@dawai/core/notes";
import { useEffect, useRef } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { dawCanvasColors, setupCanvas } from "@/lib/canvas";
import { useSelectedClip } from "@/stores/document-selectors";
import { useDocumentStore } from "@/stores/document-store";
import { useRuntimeStore } from "@/stores/runtime-store";

const GUTTER_WIDTH = 34;

/**
 * The piano roll: the selected clip fit to the panel, canvas-rendered
 * (read-only). Pitch gutter on the left, bar grid behind the notes.
 */
export function ClipView() {
  const selected = useSelectedClip();
  const beatsPerBar = useDocumentStore(
    (state) => state.document?.timeSignature[0] ?? 4,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  // Playhead line while the playing position is inside this clip —
  // transform-driven, no re-render per frame.
  useEffect(() => {
    const container = containerRef.current;
    const line = playheadRef.current;
    if (!container || !line || !selected) return;
    const { clip } = selected;
    const apply = () => {
      const { playheadBeats } = useRuntimeStore.getState();
      const within =
        playheadBeats >= clip.start && playheadBeats < clip.start + clip.length;
      if (!within) {
        line.style.display = "none";
        return;
      }
      const beatWidth = (container.clientWidth - GUTTER_WIDTH) / clip.length;
      line.style.display = "block";
      line.style.transform = `translateX(${GUTTER_WIDTH + (playheadBeats - clip.start) * beatWidth}px)`;
    };
    apply();
    return useRuntimeStore.subscribe(apply);
  }, [selected]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !selected) return;

    const draw = () => {
      const { clip } = selected;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const context = setupCanvas(canvas, width, height);
      if (!context || width === 0) return;
      const colors = dawCanvasColors();
      context.clearRect(0, 0, width, height);

      const pitches = clip.notes.map((note) => note[1]);
      const lowest = pitches.length ? Math.min(...pitches) - 2 : 34;
      const highest = pitches.length ? Math.max(...pitches) + 2 : 46;
      const rows = highest - lowest + 1;
      const rowHeight = height / rows;
      const beatWidth = (width - GUTTER_WIDTH) / clip.length;

      // Row shading + C labels.
      context.font = "9px ui-monospace, monospace";
      context.textBaseline = "middle";
      for (let pitch = lowest; pitch <= highest; pitch++) {
        const y = (highest - pitch) * rowHeight;
        if (pitch % 12 === 0) {
          context.fillStyle = colors.grid;
          context.fillRect(GUTTER_WIDTH, y, width - GUTTER_WIDTH, rowHeight);
        }
        if (pitch % 12 === 0 || rows <= 16) {
          context.fillStyle = colors.mutedForeground;
          context.fillText(midiToNoteName(pitch), 3, y + rowHeight / 2);
        }
      }

      // Beat/bar grid.
      for (let beat = 0; beat <= clip.length; beat++) {
        const x = Math.round(GUTTER_WIDTH + beat * beatWidth) + 0.5;
        context.strokeStyle =
          beat % beatsPerBar === 0 ? colors.gridStrong : colors.grid;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      // Notes, velocity as alpha.
      context.fillStyle = colors.note;
      const noteHeight = Math.max(2, rowHeight - 2);
      for (const [start, pitch, length, velocity] of clip.notes) {
        const x = GUTTER_WIDTH + start * beatWidth;
        const y = (highest - pitch) * rowHeight + 1;
        context.globalAlpha = 0.35 + (velocity / 127) * 0.65;
        context.fillRect(x, y, Math.max(2, length * beatWidth - 1), noteHeight);
      }
      context.globalAlpha = 1;
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [selected, beatsPerBar]);

  if (!selected) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>No clip selected</EmptyTitle>
          <EmptyDescription>
            Click a clip in the arrangement to open its notes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} />
      <div
        ref={playheadRef}
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-daw-accent"
        style={{ display: "none" }}
      />
    </div>
  );
}
