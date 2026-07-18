import { useEffect, useRef, useState } from "react";
import { BusHeader, BusLane } from "@/components/arrangement/bus-row";
import { Playhead } from "@/components/arrangement/playhead";
import { TimelineRuler } from "@/components/arrangement/timeline-ruler";
import { TrackHeader } from "@/components/arrangement/track-header";
import { TrackLane } from "@/components/arrangement/track-lane";
import {
  useArrangementRows,
  useSongLengthBeats,
} from "@/stores/document-selectors";
import { useDocumentStore } from "@/stores/document-store";
import { usePixelsPerBeat, useRuntimeStore } from "@/stores/runtime-store";

/**
 * The arrangement: ruler + rows (tracks clustered under their buses,
 * master last) on a shared horizontal scroll/zoom surface, headers on
 * the right. Zoom fits the song to the viewport until the user zooms;
 * pinch/ctrl-wheel zooms around the cursor (native non-passive
 * listener — React's onWheel is passive and can't stop page zoom);
 * follow mode keeps the playhead in view while playing.
 */
export function ArrangementView() {
  const rows = useArrangementRows();
  const lengthBeats = useSongLengthBeats();
  const pixelsPerBeat = usePixelsPerBeat();
  const beatsPerBar = useDocumentStore(
    (state) => state.document?.timeSignature[0] ?? 4,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Measure the scroller so short songs can fill it edge to edge.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() =>
      setViewportWidth(container.clientWidth),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fit-to-width until the user zooms manually.
  useEffect(() => {
    if (lengthBeats === 0 || viewportWidth === 0) return;
    if (useRuntimeStore.getState().hasUserZoomed) return;
    useRuntimeStore
      .getState()
      .actions.fitZoom((viewportWidth - 8) / lengthBeats);
  }, [lengthBeats, viewportWidth]);

  // Pinch/ctrl zoom around the cursor; plain scroll while playing
  // pauses follow mode (re-enable from the control bar).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      const state = useRuntimeStore.getState();
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const oldPixelsPerBeat = state.pixelsPerBeat;
        state.actions.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
        const newPixelsPerBeat = useRuntimeStore.getState().pixelsPerBeat;
        const cursorX = event.clientX - container.getBoundingClientRect().left;
        const beatAtCursor =
          (container.scrollLeft + cursorX) / oldPixelsPerBeat;
        container.scrollLeft = beatAtCursor * newPixelsPerBeat - cursorX;
      } else if (state.isPlaying && state.followPlayhead) {
        state.actions.setFollowPlayhead(false);
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // Follow playhead: page the view when the playhead nears the edge.
  useEffect(() => {
    return useRuntimeStore.subscribe((state) => {
      if (!state.followPlayhead || !state.isPlaying) return;
      const container = scrollRef.current;
      if (!container) return;
      const playheadX = state.playheadBeats * state.pixelsPerBeat;
      const view = container.clientWidth;
      if (
        playheadX < container.scrollLeft ||
        playheadX > container.scrollLeft + view * 0.85
      ) {
        container.scrollLeft = Math.max(0, playheadX - view * 0.15);
      }
    });
  }, []);

  const contentWidth = Math.max(
    viewportWidth,
    Math.ceil(lengthBeats * pixelsPerBeat) + 160,
  );
  const barWidth = beatsPerBar * pixelsPerBeat;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full">
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: contentWidth }}>
            <TimelineRuler contentWidth={contentWidth} />
            <div
              className="relative"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, var(--daw-grid) 0 1px, transparent 1px ${barWidth}px)`,
              }}
            >
              {rows.map((row) =>
                row.kind === "track" ? (
                  <TrackLane key={row.track.id} trackId={row.track.id} />
                ) : (
                  <BusLane
                    key={row.kind === "bus" ? `bus:${row.bus.id}` : "master"}
                    row={row}
                  />
                ),
              )}
              <Playhead />
            </div>
          </div>
        </div>
        <aside className="w-44 shrink-0 border-l bg-background">
          <div className="sticky top-0 z-10 h-7 border-b bg-background" />
          {rows.map((row) =>
            row.kind === "track" ? (
              <TrackHeader key={row.track.id} trackId={row.track.id} />
            ) : (
              <BusHeader
                key={row.kind === "bus" ? `bus:${row.bus.id}` : "master"}
                row={row}
              />
            ),
          )}
        </aside>
      </div>
    </div>
  );
}
