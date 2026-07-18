import { Playhead } from "@/components/arrangement/playhead";
import { TimelineRuler } from "@/components/arrangement/timeline-ruler";
import { TrackHeader } from "@/components/arrangement/track-header";
import { TrackLane } from "@/components/arrangement/track-lane";
import { useSongLengthBeats, useTracks } from "@/stores/document-selectors";
import { useDocumentStore } from "@/stores/document-store";
import { usePixelsPerBeat, useRuntimeStore } from "@/stores/runtime-store";

/**
 * The arrangement: ruler + stacked track lanes on a shared horizontal
 * scroll/zoom surface, with Ableton-style track headers on the right.
 * One vertical scroller wraps both columns so rows never desync.
 */
export function ArrangementView() {
  const tracks = useTracks();
  const lengthBeats = useSongLengthBeats();
  const pixelsPerBeat = usePixelsPerBeat();
  const beatsPerBar = useDocumentStore(
    (state) => state.document?.timeSignature[0] ?? 4,
  );

  const contentWidth = Math.ceil(lengthBeats * pixelsPerBeat) + 240;
  const barWidth = beatsPerBar * pixelsPerBeat;

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    useRuntimeStore
      .getState()
      .actions.zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full">
        <div className="min-w-0 flex-1 overflow-x-auto" onWheel={onWheel}>
          <div className="relative" style={{ width: contentWidth }}>
            <TimelineRuler contentWidth={contentWidth} />
            <div
              className="relative"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, var(--daw-grid) 0 1px, transparent 1px ${barWidth}px)`,
              }}
            >
              {tracks.map((track) => (
                <TrackLane key={track.id} trackId={track.id} />
              ))}
              <Playhead />
            </div>
          </div>
        </div>
        <aside className="w-44 shrink-0 border-l bg-background">
          <div className="sticky top-0 z-10 h-7 border-b bg-background" />
          {tracks.map((track) => (
            <TrackHeader key={track.id} trackId={track.id} />
          ))}
        </aside>
      </div>
    </div>
  );
}
