import { ClipBlock } from "@/components/arrangement/clip-block";
import { cn } from "@/lib/utils";
import { useTrack } from "@/stores/document-selectors";
import { useRuntimeStore } from "@/stores/runtime-store";

/** One horizontal lane of clips. Selection happens on clips and the header. */
export function TrackLane({ trackId }: { trackId: string }) {
  const track = useTrack(trackId);
  const isSelected = useRuntimeStore(
    (state) => state.selection.trackId === trackId,
  );
  if (!track) return null;

  return (
    <div
      className={cn(
        "relative h-14 border-b border-daw-grid bg-daw-lane",
        isSelected && "bg-daw-lane-alt",
        track.mute && "opacity-50",
      )}
    >
      {track.clips.map((clip) => (
        <ClipBlock key={clip.id} trackId={trackId} clip={clip} />
      ))}
    </div>
  );
}
