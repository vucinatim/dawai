import type { Document, Track } from "./document.ts";
import { beatsPerBar } from "./time.ts";

/** Pure Document analysis — feeds inspect views and future `analyze`. */

export function documentLengthBeats(document: Document): number {
  const clipEnds = document.tracks.flatMap((track) =>
    track.clips.map((clip) => clip.start + clip.length),
  );
  const sectionEnds = document.sections.map(
    (section) => section.start + section.length,
  );
  const automationEnds = document.automation.map(
    (lane) => (lane.points.at(-1) as (typeof lane.points)[number]).beat,
  );
  return Math.max(0, ...clipEnds, ...sectionEnds, ...automationEnds);
}

export function documentLengthBars(document: Document): number {
  return Math.ceil(
    documentLengthBeats(document) / beatsPerBar(document.timeSignature),
  );
}

/**
 * Sounding-note counts per bar for one track (index 0 = bar 1). A note
 * counts in every bar it overlaps, so sustained material (pads) reads
 * as present, not just where notes start.
 */
export function trackBarDensity(track: Track, document: Document): number[] {
  const perBar = beatsPerBar(document.timeSignature);
  const bars = documentLengthBars(document);
  const density = new Array<number>(bars).fill(0);
  for (const clip of track.clips) {
    for (const [start, , length] of clip.notes) {
      const firstBar = Math.floor((clip.start + start) / perBar);
      const lastBar = Math.min(
        bars - 1,
        Math.floor((clip.start + start + length - 1e-9) / perBar),
      );
      for (let bar = firstBar; bar <= lastBar && bar < bars; bar++) {
        density[bar] = (density[bar] ?? 0) + 1;
      }
    }
  }
  return density;
}

export interface TrackStats {
  trackId: string;
  noteCount: number;
  lowestPitch: number | undefined;
  highestPitch: number | undefined;
}

export function trackStats(track: Track): TrackStats {
  let noteCount = 0;
  let lowestPitch: number | undefined;
  let highestPitch: number | undefined;
  for (const clip of track.clips) {
    for (const [, pitch] of clip.notes) {
      noteCount++;
      lowestPitch =
        lowestPitch === undefined ? pitch : Math.min(lowestPitch, pitch);
      highestPitch =
        highestPitch === undefined ? pitch : Math.max(highestPitch, pitch);
    }
  }
  return { trackId: track.id, noteCount, lowestPitch, highestPitch };
}

export interface SectionTrackDensity {
  sectionName: string;
  /** trackId → notes per bar within the section (averaged). */
  notesPerBar: Record<string, number>;
}

export function sectionDensities(document: Document): SectionTrackDensity[] {
  const perBar = beatsPerBar(document.timeSignature);
  return document.sections.map((section) => {
    const notesPerBar: Record<string, number> = {};
    for (const track of document.tracks) {
      let count = 0;
      for (const clip of track.clips) {
        for (const [start] of clip.notes) {
          const absolute = clip.start + start;
          if (
            absolute >= section.start &&
            absolute < section.start + section.length
          )
            count++;
        }
      }
      const bars = section.length / perBar;
      notesPerBar[track.id] = Math.round((count / bars) * 10) / 10;
    }
    return { sectionName: section.name, notesPerBar };
  });
}
