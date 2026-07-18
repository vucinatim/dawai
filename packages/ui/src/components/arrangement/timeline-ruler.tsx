import { useEffect, useRef } from "react";
import { transportControls } from "@/audio/engine-bridge";
import { dawCanvasColors, setupCanvas } from "@/lib/canvas";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/stores/document-store";
import { usePixelsPerBeat, useRuntimeStore } from "@/stores/runtime-store";

const RULER_HEIGHT = 28;

/**
 * Bar ruler with section markers. Click anywhere to seek; click a
 * section name to loop that section (and seek to its start) — the
 * fastest way to audition one part of the song.
 */
export function TimelineRuler({ contentWidth }: { contentWidth: number }) {
  const pixelsPerBeat = usePixelsPerBeat();
  const sections = useDocumentStore((state) => state.document?.sections ?? []);
  const beatsPerBar = useDocumentStore(
    (state) => state.document?.timeSignature[0] ?? 4,
  );
  const loop = useRuntimeStore((state) => state.loop);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = setupCanvas(canvas, contentWidth, RULER_HEIGHT);
    if (!context) return;
    const colors = dawCanvasColors();
    const barWidth = beatsPerBar * pixelsPerBeat;
    const labelEvery = barWidth >= 40 ? 1 : barWidth >= 20 ? 4 : 8;

    context.clearRect(0, 0, contentWidth, RULER_HEIGHT);
    context.font = "9px ui-monospace, monospace";
    context.textBaseline = "bottom";
    for (let bar = 0; bar * barWidth < contentWidth; bar++) {
      const x = Math.round(bar * barWidth) + 0.5;
      const isLabeled = bar % labelEvery === 0;
      context.strokeStyle = isLabeled ? colors.gridStrong : colors.grid;
      context.beginPath();
      context.moveTo(x, isLabeled ? 14 : 21);
      context.lineTo(x, RULER_HEIGHT);
      context.stroke();
      if (isLabeled) {
        context.fillStyle = colors.mutedForeground;
        context.fillText(String(bar + 1), x + 3, RULER_HEIGHT - 2);
      }
    }
  }, [contentWidth, pixelsPerBeat, beatsPerBar]);

  const seekFromClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const beat = (event.clientX - rect.left) / pixelsPerBeat;
    transportControls.seek(Math.max(0, Math.floor(beat * 4) / 4));
  };

  const loopSection = (start: number, length: number) => {
    useRuntimeStore
      .getState()
      .actions.setLoop({ startBeat: start, endBeat: start + length });
    transportControls.seek(start);
  };

  const nudgePlayhead = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = useRuntimeStore.getState().playheadBeats;
    const delta = event.key === "ArrowRight" ? beatsPerBar : -beatsPerBar;
    transportControls.seek(Math.max(0, current + delta));
  };

  return (
    <div className="sticky top-0 z-10 h-7 border-b bg-background">
      <div
        role="slider"
        aria-label="Seek (arrow keys move by one bar)"
        aria-valuenow={0}
        tabIndex={0}
        className="absolute inset-0 cursor-pointer focus-visible:outline-1 focus-visible:outline-ring"
        onClick={seekFromClick}
        onKeyDown={nudgePlayhead}
      >
        <canvas ref={canvasRef} />
      </div>
      {sections.map((section) => {
        const isLooped =
          loop?.startBeat === section.start &&
          loop?.endBeat === section.start + section.length;
        return (
          <button
            type="button"
            key={`${section.name}@${section.start}`}
            className={cn(
              "absolute top-0 h-3.5 truncate rounded-ee-xs border-l pl-1 pr-1.5 text-left text-[9px] leading-3.5",
              isLooped
                ? "border-daw-accent bg-daw-accent/15 text-daw-accent"
                : "border-daw-clip-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            style={{
              left: section.start * pixelsPerBeat,
              maxWidth: section.length * pixelsPerBeat,
            }}
            title={`Loop "${section.name}"`}
            onClick={() => loopSection(section.start, section.length)}
          >
            {section.name}
          </button>
        );
      })}
    </div>
  );
}
