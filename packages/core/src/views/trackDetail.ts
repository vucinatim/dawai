import type { Document } from "../document.ts";
import { midiToNoteName } from "../notes.ts";
import { formatBarBeat } from "../time.ts";

/** Note-level detail for one track, optionally windowed to a beat range. */

export function renderTrackDetail(
  document: Document,
  trackId: string,
  window?: { startBeat: number; endBeat: number },
): string {
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    const available = document.tracks
      .map((candidate) => candidate.id)
      .join(", ");
    throw new Error(
      `Track "${trackId}" does not exist. Available tracks: ${available}.`,
    );
  }

  const rows: {
    absoluteBeat: number;
    pitch: number;
    length: number;
    velocity: number;
    clipId: string;
  }[] = [];
  for (const clip of track.clips) {
    for (const [start, pitch, length, velocity] of clip.notes) {
      const absoluteBeat = clip.start + start;
      if (
        window &&
        (absoluteBeat < window.startBeat || absoluteBeat >= window.endBeat)
      )
        continue;
      rows.push({ absoluteBeat, pitch, length, velocity, clipId: clip.id });
    }
  }
  rows.sort((a, b) => a.absoluteBeat - b.absoluteBeat || a.pitch - b.pitch);

  const header = `track ${track.id} (${track.name}) — ${rows.length} note${rows.length === 1 ? "" : "s"}${
    window ? ` in beats ${window.startBeat}–${window.endBeat}` : ""
  }`;
  if (rows.length === 0) return `${header}\n(no notes)`;

  const lines = rows.map((row) => {
    const position = formatBarBeat(
      row.absoluteBeat,
      document.timeSignature,
    ).padEnd(8);
    const name = midiToNoteName(row.pitch).padEnd(4);
    return `${position} ${name} len ${formatNumber(row.length).padEnd(5)} vel ${String(row.velocity).padStart(3)}  [${row.clipId}]`;
  });
  return [header, ...lines].join("\n");
}

function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
