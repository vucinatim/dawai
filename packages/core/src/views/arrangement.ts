import type { Document } from "../document.ts";
import { documentLengthBars, trackBarDensity } from "../stats.ts";
import { beatsPerBar } from "../time.ts";

/**
 * The arrangement grid: tracks × bars with density glyphs and a section
 * ruler. One character = one bar. The whole shape of a track at a
 * glance, token-cheap.
 */

const DENSITY_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export function renderArrangement(document: Document): string {
  const bars = documentLengthBars(document);
  if (bars === 0) return "(empty song — no clips, sections, or automation)";

  const labelWidth = Math.max(
    4,
    ...document.tracks.map((track) => track.id.length),
    "section".length,
  );
  const pad = (label: string) => label.padEnd(labelWidth);

  const lines = [
    `${pad("bars")} ${barRuler(bars)}`,
    `${pad("section")} ${sectionRuler(document, bars)}`,
    ...document.tracks.map((track) => {
      const density = trackBarDensity(track, document);
      const max = Math.max(1, ...density);
      const row = density
        .map((count) =>
          count === 0
            ? "."
            : DENSITY_GLYPHS[
                Math.min(
                  DENSITY_GLYPHS.length - 1,
                  Math.floor((count / max) * DENSITY_GLYPHS.length),
                )
              ],
        )
        .join("");
      return `${pad(track.id)} ${row}${track.mute ? "  (muted)" : ""}`;
    }),
  ];
  return lines.join("\n");
}

function barRuler(bars: number): string {
  const characters = new Array<string>(bars).fill(" ");
  for (let bar = 0; bar < bars; bar += 8) {
    const label = String(bar + 1);
    for (let index = 0; index < label.length && bar + index < bars; index++) {
      characters[bar + index] = label[index] as string;
    }
  }
  return characters.join("");
}

function sectionRuler(document: Document, bars: number): string {
  const perBar = beatsPerBar(document.timeSignature);
  const characters = new Array<string>(bars).fill(" ");
  for (const section of document.sections) {
    const startBar = Math.floor(section.start / perBar);
    if (startBar >= bars) continue;
    const label = `|${section.name}`;
    for (
      let index = 0;
      index < label.length && startBar + index < bars;
      index++
    ) {
      if (index > 0 && characters[startBar + index] === "|") break;
      characters[startBar + index] = label[index] as string;
    }
  }
  return characters.join("").trimEnd();
}
