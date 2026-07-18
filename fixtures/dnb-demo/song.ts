import { automate, bars, ramp } from "@dawai/composer/automation";
import { arp, chords, euclid, melody } from "@dawai/composer/builders";
import {
  every,
  humanize,
  stack,
  transpose,
  vary,
  velocity,
} from "@dawai/composer/combinators";
import {
  compressor,
  distortion,
  eq,
  filter,
  limiter,
  reverb,
} from "@dawai/composer/fx";
import { drums, kit, sampler, synth } from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { bus, duck, song, track } from "@dawai/composer/song";

// ── Drums ────────────────────────────────────────────────────────────
// Classic 2-step at 174: kick on 1 and the "and" of 3, snare on 2 and 4.

const dnbKit = kit("dnb-standard");

const twoStep = drums(dnbKit, {
  kick: "x.........x.....",
  snare: "....x.......x...",
});

const ghosts = drums(dnbKit, {
  snare: "......o..o....o.",
});

const hats = humanize(
  stack(
    drums(dnbKit, { chh: "x.x.x.x.x.x.x.x." }),
    velocity(euclid(7, 16, 70), 0.6), // shaker pitch, quiet syncopation
  ),
  { timing: 0.008, velocity: 10, seed: 174 },
);

// The fill's snare roll deliberately avoids step 13 (the 2-step's main
// snare) so layered hits never land on the same instant.
const fill = drums(dnbKit, {
  snare: "..........o..xxX",
  crash: "............x...",
});

const fullDrums = every(
  4,
  stack(twoStep, ghosts, hats),
  stack(twoStep, fill, hats),
);
const buildDrums = stack(
  drums(dnbKit, { snare: "x...x...x.x.x.xx" }),
  drums(dnbKit, { chh: "x.x.x.x.x.x.x.x." }),
);

// ── Bass ─────────────────────────────────────────────────────────────
// Sub carries the riff; the reese doubles it an octave up for the mids.

const bassRiff = melody("E1 ~ ~ . G1 ~ . A1 ~ ~ . C2 ~ B1 ~ .", { step: 0.5 });
const bassRiffB = melody("E1 ~ ~ . G1 ~ . A1 ~ ~ . D2 ~ C2 ~ .", { step: 0.5 });
const reeseRiff = transpose(bassRiff, 12);
const reeseRiffB = transpose(bassRiffB, 12);

// ── Music ────────────────────────────────────────────────────────────

const padProgression = chords(["Em9", "Cmaj7", "Am7", "Bm7"], {
  beats: 8,
  octave: 3,
});
const atmosphereArp = velocity(
  arp("Em9", { style: "updown", step: 0.25, octaves: 2 }),
  0.7,
);
// Synthesized break layer (v0 has no sample playback): ghost-snare
// chatter and a ride pattern riding over the main kit, humanized.
const breakLoop = humanize(
  drums(dnbKit, {
    snare: "..o..o.o...o..o.",
    ride: "x..x.x..x..x..x.",
  }),
  { timing: 0.012, velocity: 14, seed: 99 },
);

// ── Sections ─────────────────────────────────────────────────────────

const intro = section("intro", 16, {
  pads: padProgression,
  arp: atmosphereArp,
});

// Sections are values and components are just functions — the reprise
// is the same buildup at a different length, ramps included.
function buildup(lengthBars: number) {
  return section(
    "buildup",
    lengthBars,
    {
      drums: buildDrums,
      reese: reeseRiff,
      pads: padProgression,
      arp: atmosphereArp,
    },
    {
      automation: [
        automate(
          "reese.fx.filter.cutoff",
          ramp(bars(lengthBars), 400, 8000, "exp"),
        ),
        automate("drums.gain", ramp(bars(lengthBars), -12, -3)),
      ],
    },
  );
}

const drop1 = section("drop", 32, {
  drums: fullDrums,
  breaks: breakLoop,
  sub: bassRiff,
  reese: reeseRiff,
  pads: padProgression,
});

const breakdown = section(
  "breakdown",
  16,
  {
    pads: padProgression,
    arp: atmosphereArp,
    sub: velocity(bassRiff, 0.8),
  },
  {
    automation: [automate("pads.fx.reverb.mix", ramp(bars(16), 0.2, 0.5))],
  },
);

const drop2 = drop1.with({
  drums: every(
    4,
    stack(twoStep, vary(ghosts, { seed: 9, amount: 0.6 }), hats),
    stack(twoStep, fill, hats),
  ),
  sub: bassRiffB,
  reese: reeseRiffB,
});

const outro = section(
  "outro",
  16,
  {
    pads: padProgression,
    arp: atmosphereArp,
  },
  {
    automation: [automate("pads.gain", ramp(bars(16), -10, -38))],
  },
);

// ── The song ─────────────────────────────────────────────────────────

export default song({
  name: "Neon Rain",
  tempo: 174,
  timeSignature: [4, 4],
  tracks: [
    track("drums", sampler(dnbKit), {
      gain: -3,
      out: "drumbus",
      fx: [eq({ low: 1, high: 2 })],
    }),
    track("breaks", sampler(dnbKit), {
      gain: -10,
      out: "drumbus",
      fx: [filter("highpass", 300)],
    }),
    track("sub", synth("sub-sine"), {
      gain: -4,
      duck: duck({ trigger: "drums:kick", amount: -5, release: 0.4 }),
    }),
    track("reese", synth("reese"), {
      gain: -8,
      fx: [filter("lowpass", 900, 1.2), distortion(0.25)],
    }),
    track("pads", synth("warm-pad"), {
      gain: -10,
      out: "music",
      fx: [reverb({ decay: 5, mix: 0.2 })],
    }),
    track("arp", synth("pluck"), {
      gain: -14,
      pan: 0.2,
      out: "music",
      fx: [reverb(0.35)],
    }),
  ],
  buses: {
    drumbus: bus({
      fx: [
        compressor({ threshold: -18, ratio: 4, attack: 0.003, release: 0.15 }),
        eq({ low: -1 }),
      ],
    }),
    music: bus({
      gain: -2,
      duck: duck({ trigger: "drums:kick", amount: -3, release: 0.35 }),
    }),
  },
  master: [eq({ high: 1 }), limiter(-1)],
  arrangement: [intro, buildup(16), drop1, breakdown, buildup(8), drop2, outro],
});
