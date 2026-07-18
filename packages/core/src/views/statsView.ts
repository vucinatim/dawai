import type { Document } from "../document.ts";
import { midiToNoteName } from "../notes.ts";
import {
  documentLengthBars,
  documentLengthBeats,
  sectionDensities,
  trackStats,
} from "../stats.ts";

/** Aggregate stats: song shape, pitch ranges, per-section density, warnings. */

export function renderStats(document: Document): string {
  const lines: string[] = [];
  const lengthBars = documentLengthBars(document);
  const lengthBeats = documentLengthBeats(document);
  const minutes = lengthBeats / document.tempo;
  lines.push(
    `${document.name} — ${document.tempo} BPM, ${document.timeSignature.join("/")}, ${lengthBars} bars (~${formatMinutes(minutes)})`,
  );

  lines.push("tracks");
  for (const track of document.tracks) {
    const stats = trackStats(track);
    const range =
      stats.lowestPitch === undefined || stats.highestPitch === undefined
        ? "—"
        : `${midiToNoteName(stats.lowestPitch)}–${midiToNoteName(stats.highestPitch)}`;
    lines.push(
      `  ${track.id.padEnd(10)} ${String(stats.noteCount).padStart(5)} notes  range ${range}`,
    );
  }

  if (document.sections.length > 0) {
    lines.push("sections (notes per bar)");
    for (const density of sectionDensities(document)) {
      const cells = Object.entries(density.notesPerBar)
        .map(([trackId, value]) => `${trackId}=${value}`)
        .join("  ");
      lines.push(`  ${density.sectionName.padEnd(12)} ${cells}`);
    }
  }

  const warnings = collectWarnings(document);
  if (warnings.length > 0) {
    lines.push("warnings");
    for (const warning of warnings) lines.push(`  ! ${warning}`);
  }

  return lines.join("\n");
}

function collectWarnings(document: Document): string[] {
  const warnings: string[] = [];
  for (const track of document.tracks) {
    const stats = trackStats(track);
    if (stats.noteCount === 0)
      warnings.push(`Track "${track.id}" has no notes.`);
  }
  if (document.sections.length === 0)
    warnings.push("Song has no sections (no arrangement markers).");
  return warnings;
}

function formatMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
