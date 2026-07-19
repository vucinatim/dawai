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
/** Width of the right-stuck header column (tailwind w-44). */
const HEADERS_WIDTH = 176;

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
      .actions.fitZoom((viewportWidth - HEADERS_WIDTH - 8) / lengthBeats);
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
        // Delta-proportional: pinch events stream many small deltas —
        // a fixed step per event makes a tiny pinch zoom to the limit.
        state.actions.zoomBy(Math.exp(-event.deltaY * 0.005));
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
      const view = container.clientWidth - HEADERS_WIDTH;
      if (
        playheadX < container.scrollLeft ||
        playheadX > container.scrollLeft + view * 0.85
      ) {
        container.scrollLeft = Math.max(0, playheadX - view * 0.15);
      }
    });
  }, []);

  // Clicks that land on plain lane background (not a clip, header, or
  // section button, and not the seek slider) clear the selection;
  // Escape clears it from anywhere. Native listeners like the wheel
  // handler above — this is scroll-surface behavior, not a control.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onClick = (event: MouseEvent) => {
      const interactive = (event.target as HTMLElement).closest(
        'button, [role="slider"]',
      );
      if (!interactive) useRuntimeStore.getState().actions.clearSelection();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        useRuntimeStore.getState().actions.clearSelection();
    };
    container.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const contentWidth = Math.max(
    viewportWidth - HEADERS_WIDTH,
    Math.ceil(lengthBeats * pixelsPerBeat) + 160,
  );
  const barWidth = beatsPerBar * pixelsPerBeat;

  return (
    // Single scroll surface for both axes: the ruler sticks to its top,
    // the header column sticks to its right — CSS sticky only works
    // against the element that actually scrolls.
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div className="flex min-h-full">
        <div className="relative shrink-0" style={{ width: contentWidth }}>
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
        <aside className="sticky right-0 z-20 w-44 shrink-0 border-l bg-background">
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
