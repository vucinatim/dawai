import { arp, chords, melody, notes } from "@dawai/composer/builders";
import { filter, limiter } from "@dawai/composer/fx";
import { riser, sweep } from "@dawai/composer/idioms";
import { drums, kit, sampler, synth } from "@dawai/composer/instruments";
import type { Pattern } from "@dawai/composer/pattern";
import {
  type Section,
  type SectionPart,
  section,
} from "@dawai/composer/section";
import { song, track } from "@dawai/composer/song";
import type { SynthPresetId } from "@dawai/core/presets";

// The listening checklist: every preset and every kit pad in labeled
// 2-bar sections, one sound at a time. Play top to bottom and judge
// each entry keep / fix.

const standardKit = kit("dnb-standard");

const bassPhrase = melody("E1 ~ G1 ~ A1 ~ B1 ~", { step: 1 });
const chordPhrase = chords(["Em9", "Cmaj7"], { beats: 4 });
const leadPhrase = melody("E3 G3 B3 E4 D4 B3 G3 D3", { step: 1 });
const arpPhrase = arp("Em9", { style: "updown", step: 0.25, octaves: 2 });
const stabPhrase = notes([
  [0, "E3", 0.5, 118],
  [1.5, "G3", 0.5, 100],
  [3, "B3", 0.5, 110],
  [4.5, "E3", 0.5, 100],
  [6, "D3", 0.5, 118],
]);

const PRESET_PHRASES: Record<SynthPresetId, Pattern> = {
  "sub-sine": bassPhrase,
  reese: bassPhrase,
  "fat-saw": stabPhrase,
  supersaw: chordPhrase,
  "warm-pad": chordPhrase,
  pluck: arpPhrase,
  keys: chordPhrase,
  bell: leadPhrase,
  hoover: leadPhrase,
  stab: stabPhrase,
  "riser-noise": bassPhrase, // replaced by riser()/sweep() below
  "arp-saw": arpPhrase,
};

const presetTracks = Object.keys(PRESET_PHRASES).map((preset) =>
  track(`p-${preset}`, synth(preset as SynthPresetId), {
    gain: -8,
    ...(preset === "riser-noise" ? { fx: [filter("bandpass", 500, 1.5)] } : {}),
  }),
);

const presetSections: Section[] = Object.entries(PRESET_PHRASES).map(
  ([preset, phrase]) => {
    const part: SectionPart =
      preset === "riser-noise" ? riser(4, { holdBeats: 8 }) : phrase;
    return section(`p:${preset}`, 2, { [`p-${preset}`]: part });
  },
);

// The riser preset also demos sweep() right after its riser section.
presetSections.splice(
  presetSections.findIndex((entry) => entry.name === "p:riser-noise") + 1,
  0,
  section("p:sweep", 2, { "p-riser-noise": sweep(4, { holdBeats: 8 }) }),
);

const PAD_GRIDS: Record<string, string> = {
  impact: "x...............",
  kick: "x...x...x...x...",
  snare: "....x.......x...",
  rim: "x.x.x.x.x.x.x.x.",
  clap: "....x.......x...",
  chh: "x.x.x.x.x.x.x.x.",
  phh: "x.x.x.x.x.x.x.x.",
  ohh: "..x...x...x...x.",
  crash: "x...............",
  ride: "x.x.x.x.x.x.x.x.",
  perc1: "x..x..x..x..x..x",
  perc2: ".x..x..x..x..x..",
  shaker: "xxxxxxxxxxxxxxxx",
};

const padSections: Section[] = Object.entries(PAD_GRIDS).map(([pad, grid]) =>
  section(`d:${pad}`, 2, { drums: drums(standardKit, { [pad]: grid }) }),
);

export default song({
  name: "Sound Tour",
  tempo: 120,
  timeSignature: [4, 4],
  tracks: [...presetTracks, track("drums", sampler(standardKit), { gain: -4 })],
  master: [limiter(-1)],
  arrangement: [...presetSections, ...padSections],
});
