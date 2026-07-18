import type { Instrument } from "@dawai/core/document";
import { cn } from "@/lib/utils";
import { useTrack } from "@/stores/document-selectors";
import { useRuntimeStore } from "@/stores/runtime-store";

/**
 * Ableton-style right-side track header: name, instrument, gain, and
 * the interactive solo (S) / listen-mute (M) monitoring toggles —
 * runtime renderer gains only, never the Document. Authored mute from
 * source renders as a dimmed row with a static badge.
 */
export function TrackHeader({ trackId }: { trackId: string }) {
  const track = useTrack(trackId);
  const isSelected = useRuntimeStore(
    (state) => state.selection.trackId === trackId,
  );
  const isSoloed = useRuntimeStore((state) =>
    state.soloedTrackIds.includes(trackId),
  );
  const isListenMuted = useRuntimeStore((state) =>
    state.listenMutedTrackIds.includes(trackId),
  );
  if (!track) return null;
  const actions = useRuntimeStore.getState().actions;

  return (
    <div
      className={cn(
        "relative h-14 border-b",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
        track.mute && "opacity-50",
      )}
    >
      {/* The whole rectangle selects the track; content floats above,
          with only the S/M toggles re-enabling pointer events. */}
      <button
        type="button"
        aria-label={`Select track ${track.name}`}
        className="absolute inset-0 cursor-default focus-visible:outline-1 focus-visible:outline-ring"
        onClick={() => actions.selectTrack(trackId)}
        onKeyDown={(event) => {
          if (event.key === "s") actions.toggleSolo(trackId);
          if (event.key === "m") actions.toggleListenMute(trackId);
        }}
      />
      <div className="pointer-events-none relative flex h-full flex-col justify-between px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {track.name}
          </span>
          <div className="pointer-events-auto flex gap-0.5">
            <MonitorToggle
              label="S"
              title="Solo (monitoring only)"
              active={isSoloed}
              onToggle={() => actions.toggleSolo(trackId)}
            />
            <MonitorToggle
              label="M"
              title="Listen-mute (monitoring only)"
              active={isListenMuted}
              onToggle={() => actions.toggleListenMute(trackId)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-mono text-[9px] text-muted-foreground">
            {instrumentLabel(track.instrument)}
            {track.mute && " · muted"}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {track.gain > 0 ? "+" : ""}
            {track.gain}dB
          </span>
        </div>
      </div>
    </div>
  );
}

function MonitorToggle({
  label,
  title,
  active,
  onToggle,
}: {
  label: string;
  title: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      className={cn(
        "size-4 rounded-xs border text-center text-[9px] font-semibold leading-[14px]",
        active
          ? "border-transparent bg-daw-accent text-daw-accent-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {label}
    </button>
  );
}

function instrumentLabel(instrument: Instrument): string {
  switch (instrument.kind) {
    case "synth":
      return instrument.preset;
    case "sampler":
      return `kit:${instrument.kit}`;
    case "sample":
      return `sample:${instrument.source}`;
  }
}
