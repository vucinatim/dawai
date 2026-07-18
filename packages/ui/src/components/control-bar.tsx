import { formatBarBeat } from "@dawai/core/time";
import {
  LocateFixedIcon,
  PlayIcon,
  RepeatIcon,
  SquareIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { transportControls } from "@/audio/engine-bridge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/stores/document-store";
import { useIsPlaying, useLoop, useRuntimeStore } from "@/stores/runtime-store";

/** Ableton's control bar: song facts left, transport dead center. */
export function ControlBar() {
  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-3">
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          dawai
        </span>
        <SongFacts />
      </div>
      <div className="flex items-center gap-1">
        <PlayButton />
        <StopButton />
        <LoopButton />
        <PositionReadout />
      </div>
      <div className="flex items-center justify-end gap-1">
        <FollowButton />
        <ZoomButtons />
      </div>
    </header>
  );
}

function FollowButton() {
  const following = useRuntimeStore((state) => state.followPlayhead);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Follow playhead"
      aria-pressed={following}
      className={cn(following && "text-daw-accent")}
      onClick={() => useRuntimeStore.getState().actions.toggleFollowPlayhead()}
    >
      <LocateFixedIcon />
    </Button>
  );
}

function PlayButton() {
  const isPlaying = useIsPlaying();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Play"
      className={cn(isPlaying && "text-daw-accent")}
      onClick={() => transportControls.togglePlay()}
    >
      <PlayIcon fill={isPlaying ? "currentColor" : "none"} />
    </Button>
  );
}

function StopButton() {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Stop"
      onClick={() => transportControls.stop()}
    >
      <SquareIcon />
    </Button>
  );
}

function LoopButton() {
  const loop = useLoop();
  const clearLoop = () => useRuntimeStore.getState().actions.setLoop(null);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={loop ? "Clear loop" : "Loop (click a section name to set)"}
      className={cn(loop && "text-daw-accent")}
      disabled={!loop}
      onClick={clearLoop}
    >
      <RepeatIcon />
    </Button>
  );
}

function PositionReadout() {
  // Quantized selector: re-renders on 16th-note changes, not every frame.
  const quantizedBeats = useRuntimeStore(
    (state) => Math.floor(state.playheadBeats * 4) / 4,
  );
  const timeSignature = useDocumentStore(
    (state) => state.document?.timeSignature ?? null,
  );
  if (!timeSignature) return null;
  return (
    <span className="w-16 font-mono text-xs tabular-nums text-foreground">
      {formatBarBeat(quantizedBeats, timeSignature)}
    </span>
  );
}

function SongFacts() {
  const name = useDocumentStore((state) => state.document?.name ?? "");
  const tempo = useDocumentStore((state) => state.document?.tempo ?? 0);
  const timeSignature = useDocumentStore(
    (state) => state.document?.timeSignature ?? null,
  );
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="font-medium">{name}</span>
      <span className="font-mono tabular-nums text-muted-foreground">
        {tempo} BPM
      </span>
      {timeSignature && (
        <span className="font-mono tabular-nums text-muted-foreground">
          {timeSignature[0]}/{timeSignature[1]}
        </span>
      )}
    </div>
  );
}

function ZoomButtons() {
  const zoomBy = (factor: number) =>
    useRuntimeStore.getState().actions.zoomBy(factor);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        onClick={() => zoomBy(1 / 1.4)}
      >
        <ZoomOutIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        onClick={() => zoomBy(1.4)}
      >
        <ZoomInIcon />
      </Button>
    </>
  );
}
