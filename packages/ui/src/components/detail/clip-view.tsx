import { midiToNoteName } from "@dawai/core/notes";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
const PITCH_COUNT = 128;
const DEFAULT_ROW_HEIGHT = 14;
const MIN_ROW_HEIGHT = 6;
const MAX_ROW_HEIGHT = 32;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

/**
 * The piano roll: full 128-key range on a scrollable surface with a
 * sticky keyboard gutter, canvas-rendered (read-only). Opens fit to
 * the clip and centered on its notes; ctrl/cmd-wheel zooms the rows
 * vertically around the cursor.
 */
export function ClipView() {
  const selected = useSelectedClip();
  const beatsPerBar = useDocumentStore(
    (state) => state.document?.timeSignature[0] ?? 4,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(24);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;
  const zoomAnchorRef = useRef<{ pitchRow: number; cursorY: number } | null>(
    null,
  );
  const contentHeight = PITCH_COUNT * rowHeight;

  const clipKey = selected ? `${selected.track.id}:${selected.clip.id}` : null;
  const openedClipKeyRef = useRef<string | null>(null);

  // A newly selected clip opens fit-to-width and centered on its notes
  // (the ref guard keeps re-renders of the same clip from resetting).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !selected) return;
    if (clipKey === openedClipKeyRef.current) return;
    openedClipKeyRef.current = clipKey;
    const fit = (container.clientWidth - GUTTER_WIDTH) / selected.clip.length;
    setPixelsPerBeat(Math.min(96, Math.max(2, fit)));
    const pitches = selected.clip.notes.map((note) => note[1]);
    const center = pitches.length
      ? (Math.min(...pitches) + Math.max(...pitches)) / 2
      : 60;
    container.scrollTop =
      (127 - center) * rowHeight - container.clientHeight / 2;
    container.scrollLeft = 0;
  }, [clipKey, selected, rowHeight]);

  // Ctrl/cmd-wheel zooms rows vertically around the cursor, delta-
  // proportional — pinch events stream many small deltas and a fixed
  // step per event zooms to the limit on the lightest touch. (Native
  // non-passive listener — React's onWheel is passive and can't stop
  // page zoom.)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const old = rowHeightRef.current;
      const next = Math.min(
        MAX_ROW_HEIGHT,
        Math.max(MIN_ROW_HEIGHT, old * Math.exp(-event.deltaY * 0.005)),
      );
      if (next === old) return;
      // Anchor the pitch under the cursor; the scroll is applied in the
      // layout effect below, once the content actually has its new
      // height — setting it here would clamp against the old range.
      const cursorY = event.clientY - container.getBoundingClientRect().top;
      zoomAnchorRef.current = {
        pitchRow: (container.scrollTop + cursorY) / old,
        cursorY,
      };
      setRowHeight(next);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the zoom anchor under the cursor after the content resized.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const anchor = zoomAnchorRef.current;
    if (!container || !anchor) return;
    zoomAnchorRef.current = null;
    container.scrollTop = anchor.pitchRow * rowHeight - anchor.cursorY;
  }, [rowHeight]);

  // Playhead line while the playing position is inside this clip —
  // transform-driven, no re-render per frame.
  useEffect(() => {
    const line = playheadRef.current;
    if (!line || !selected) return;
    const { clip } = selected;
    const apply = () => {
      const { playheadBeats } = useRuntimeStore.getState();
      const within =
        playheadBeats >= clip.start && playheadBeats < clip.start + clip.length;
      if (!within) {
        line.style.display = "none";
        return;
      }
      line.style.display = "block";
      line.style.transform = `translateX(${(playheadBeats - clip.start) * pixelsPerBeat}px)`;
    };
    apply();
    return useRuntimeStore.subscribe(apply);
  }, [selected, pixelsPerBeat]);

  // Keyboard gutter: flat full-width key rows — ivory for white keys,
  // near-black for black keys — labeled on every key when rows are
  // tall enough (contrast-matched text), Cs only when cramped. Key
  // colors are fixed — a keyboard is ivory and ebony in any theme.
  useEffect(() => {
    const canvas = gutterRef.current;
    if (!canvas || !selected) return;
    const context = setupCanvas(canvas, GUTTER_WIDTH, contentHeight);
    if (!context) return;
    context.fillStyle = "#b4b4b4";
    context.fillRect(0, 0, GUTTER_WIDTH - 1, contentHeight);
    const keyFontPx = Math.max(7, Math.min(9, Math.floor(rowHeight) - 2));
    context.font = `${keyFontPx}px ui-monospace, monospace`;
    context.textBaseline = "middle";
    context.textAlign = "right";
    const labelEveryKey = rowHeight >= 8;
    for (let pitch = 0; pitch < PITCH_COUNT; pitch++) {
      const y = (127 - pitch) * rowHeight;
      const semitone = pitch % 12;
      const isBlack = BLACK_KEYS.has(semitone);
      if (isBlack) {
        context.fillStyle = "#141414";
        context.fillRect(0, y, GUTTER_WIDTH - 1, rowHeight);
      }
      if (semitone === 0 || semitone === 5) {
        // The edge below C and F is where two white keys touch.
        const edge = Math.round(y + rowHeight) + 0.5;
        context.strokeStyle = "rgb(0 0 0 / 40%)";
        context.beginPath();
        context.moveTo(0, edge);
        context.lineTo(GUTTER_WIDTH - 1, edge);
        context.stroke();
      }
      if (labelEveryKey || semitone === 0) {
        context.fillStyle = isBlack ? "#d4d4d4" : "#1c1c1c";
        context.fillText(
          midiToNoteName(pitch),
          GUTTER_WIDTH - 5,
          y + rowHeight / 2 + 0.5,
        );
      }
    }
    context.textAlign = "left";
  }, [selected, rowHeight, contentHeight]);

  // Note grid: black-key row striping, beat/bar lines, notes with
  // velocity as alpha.
  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas || !selected) return;
    const { clip } = selected;
    const width = Math.max(1, Math.ceil(clip.length * pixelsPerBeat));
    const context = setupCanvas(canvas, width, contentHeight);
    if (!context) return;
    const colors = dawCanvasColors();
    context.clearRect(0, 0, width, contentHeight);

    context.fillStyle = "rgb(0 0 0 / 25%)";
    for (let pitch = 0; pitch < PITCH_COUNT; pitch++) {
      if (!BLACK_KEYS.has(pitch % 12)) continue;
      context.fillRect(0, (127 - pitch) * rowHeight, width, rowHeight);
    }

    for (let beat = 0; beat <= clip.length; beat++) {
      const x = Math.round(beat * pixelsPerBeat) + 0.5;
      context.strokeStyle =
        beat % beatsPerBar === 0 ? colors.gridStrong : colors.grid;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, contentHeight);
      context.stroke();
    }

    context.fillStyle = colors.note;
    for (const [start, pitch, length, velocity] of clip.notes) {
      context.globalAlpha = 0.35 + (velocity / 127) * 0.65;
      context.fillRect(
        start * pixelsPerBeat,
        (127 - pitch) * rowHeight + 1,
        Math.max(2, length * pixelsPerBeat - 1),
        Math.max(2, rowHeight - 2),
      );
    }
    context.globalAlpha = 1;
  }, [selected, pixelsPerBeat, beatsPerBar, rowHeight, contentHeight]);

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

  const clipWidth = Math.max(
    1,
    Math.ceil(selected.clip.length * pixelsPerBeat),
  );

  return (
    <div ref={scrollRef} className="h-full w-full overflow-auto">
      <div
        className="relative flex"
        style={{ height: contentHeight, width: GUTTER_WIDTH + clipWidth }}
      >
        <canvas ref={gutterRef} className="sticky left-0 z-10 shrink-0" />
        <div className="relative" style={{ width: clipWidth }}>
          <canvas ref={gridRef} />
          <div
            ref={playheadRef}
            className="pointer-events-none absolute inset-y-0 left-0 w-px bg-daw-accent"
            style={{ display: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
