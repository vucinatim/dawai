import { automate, bars, ramp } from "@dawai/composer/automation";
import { chords, melody } from "@dawai/composer/builders";
import {
  every,
  humanize,
  seq,
  stack,
  swing,
  transpose,
  velocity,
} from "@dawai/composer/combinators";
import {
  compressor,
  delay,
  eq,
  filter,
  limiter,
  ott,
  reverb,
} from "@dawai/composer/fx";
import { impact, riser, sweep } from "@dawai/composer/idioms";
import {
  customVoice,
  drums,
  kit,
  sampler,
  synth,
} from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { bus, duck, song, track } from "@dawai/composer/song";

// ── Kits ─────────────────────────────────────────────────────────────

const houseKit = kit("tr-909");
const percKit = kit("dnb-standard");

// ── Bass voice ───────────────────────────────────────────────────────
// Fisher-style tech bass: tight saw bite over a square sub-octave,
// short filter snap for the "talking" attack, driven for grit.

const techBass = customVoice({
  layers: [
    {
      kind: "osc",
      type: "sawtooth",
      voices: 2,
      spread: 10,
      detune: 0,
      octave: 0,
      gain: 0,
    },
    {
      kind: "osc",
      type: "square",
      voices: 1,
      spread: 0,
      detune: 0,
      octave: -1,
      gain: -4,
    },
  ],
  amp: { attack: 0.003, decay: 0.22, sustain: 0.25, release: 0.12 },
  filter: { mode: "lowpass", cutoff: 420, q: 1.8 },
  filterEnvelope: {
    attack: 0.003,
    decay: 0.14,
    sustain: 0.15,
    release: 0.1,
    octaves: 2.6,
  },
  drive: 0.3,
  chorus: 0,
});

// ── Drums ────────────────────────────────────────────────────────────
// Four-on-the-floor with clap on 2 & 4; closed hats fill the 16ths and
// step aside where the open hat pumps the offbeat 8ths.

const kickFour = drums(houseKit, { kick: "x...x...x...x..." });
const claps = drums(houseKit, { clap: "....x.......x..." });
const closedHats = swing(
  velocity(drums(houseKit, { chh: "xx.xxx.xxx.xxx.x" }), 0.75),
  0.55,
);
const openHats = swing(drums(houseKit, { ohh: "..x...x...x...x." }), 0.55);
const rimTicks = velocity(drums(houseKit, { rim: "......x.......x." }), 0.5);

const introGroove = stack(kickFour, closedHats, rimTicks);
const fullGroove = stack(kickFour, claps, closedHats, openHats);

// Snare rises through the buildup while the kick keeps stomping.
const buildDrums = stack(
  kickFour,
  drums(houseKit, { snare: "x...x...x.x.x.xx" }),
);

// Shaker sixteenths and sparse toms from the perc kit, swung and loose.
const shakerLoop = humanize(
  swing(velocity(drums(percKit, { shaker: "xxxxxxxxxxxxxxxx" }), 0.5), 0.55),
  { timing: 0.006, velocity: 12, seed: 126 },
);
const percHits = velocity(
  drums(percKit, { perc1: "...x......x.....", perc2: ".......x......x." }),
  0.65,
);
const percsLight = shakerLoop;
const percsFull = stack(shakerLoop, percHits);

// ── Bass lines ───────────────────────────────────────────────────────
// Offbeat pump between the kicks — the engine of the groove.

const bassA = melody(". G2 . G2 . G2 . G2 . G2 . Bb2 . C3 ~ .", { step: 0.5 });
const bassB = melody(". G2 . G2 . G2 . F2 . G2 . Bb2 . D3 ~ .", { step: 0.5 });
const bassDrop1 = seq(bassA, bassA, bassA, bassB);
const bassDrop2 = seq(bassB, bassA, bassB, bassA);

// ── Hook ─────────────────────────────────────────────────────────────
// The talky stab phrase that stands in for a vocal chop.

const hook = melody("G3 ~ . Bb3 . . G3 . . F3 . D3 ~ . . .", { step: 0.5 });
const hookTease = velocity(hook, 0.55);

// ── Breakdown pads ───────────────────────────────────────────────────

const padProgression = chords(["Gm7", "Ebmaj7", "Bbmaj7", "F7"], {
  beats: 8,
  octave: 3,
});

// ── Sections ─────────────────────────────────────────────────────────

const intro = section("intro", 8, {
  drums: introGroove,
  percs: percsLight,
  stabs: hookTease,
});

const groove = section("groove", 8, {
  drums: stack(introGroove, claps),
  percs: percsLight,
  bass: bassA,
});

function buildup(lengthBars: number) {
  return section(
    "buildup",
    lengthBars,
    {
      drums: buildDrums,
      stabs: hook,
      fx: riser(lengthBars * 4),
    },
    {
      automation: [
        automate("drums.gain", ramp(bars(lengthBars), -10, -3)),
        automate("stabs.fx.delay.mix", ramp(bars(lengthBars), 0.22, 0.5)),
      ],
    },
  );
}

const drop1 = section("drop", 16, {
  drums: fullGroove,
  percs: percsFull,
  bass: bassDrop1,
  stabs: hook,
  impacts: impact(percKit, { holdBeats: 64 }),
  fx: sweep(8, { holdBeats: 64 }),
});

const breakdown = section(
  "breakdown",
  8,
  {
    pads: padProgression,
    stabs: velocity(hook, 0.7),
    percs: percsLight,
  },
  {
    automation: [automate("pads.fx.reverb.mix", ramp(bars(8), 0.25, 0.5))],
  },
);

const drop2 = drop1.with({
  bass: bassDrop2,
  stabs: every(4, hook, transpose(hook, 12)),
  percs: stack(percsFull, rimTicks),
});

const outro = section(
  "outro",
  8,
  {
    drums: introGroove,
    percs: percsLight,
  },
  {
    automation: [
      automate("drums.gain", ramp(bars(8), -3, -24)),
      automate("percs.gain", ramp(bars(8), -12, -30)),
    ],
  },
);

// ── The song ─────────────────────────────────────────────────────────

export default song({
  name: "Night Shift",
  tempo: 126,
  timeSignature: [4, 4],
  tracks: [
    track("drums", sampler(houseKit), {
      gain: -3,
      out: "drumbus",
      fx: [eq({ low: 1, high: 1 })],
    }),
    track("percs", sampler(percKit), {
      gain: -12,
      pan: 0.15,
      out: "drumbus",
    }),
    track("impacts", sampler(percKit), {
      gain: -6,
      out: "drumbus",
    }),
    track("bass", techBass, {
      gain: -5,
      duck: duck({ trigger: "drums:kick", amount: -6, release: 0.28 }),
    }),
    track("stabs", synth("stab"), {
      gain: -10,
      pan: -0.1,
      out: "music",
      fx: [delay({ time: 0.75, feedback: 0.3, mix: 0.22 }), reverb(0.18)],
    }),
    track("pads", synth("warm-pad"), {
      gain: -12,
      out: "music",
      fx: [reverb({ decay: 4, mix: 0.25 })],
    }),
    track("fx", synth("riser-noise"), {
      gain: -14,
      out: "music",
      fx: [filter("bandpass", 600, 1.5)],
    }),
  ],
  buses: {
    drumbus: bus({
      fx: [
        compressor({ threshold: -16, ratio: 4, attack: 0.002, release: 0.12 }),
        ott({ amount: 0.4, gain: 1.5 }),
        eq({ low: 1 }),
      ],
    }),
    music: bus({
      gain: -2,
      fx: [ott({ amount: 0.25, gain: 1 })],
      duck: duck({ trigger: "drums:kick", amount: -4, release: 0.28 }),
    }),
  },
  master: [eq({ high: 1 }), limiter(-1)],
  arrangement: [
    intro,
    groove,
    buildup(8),
    drop1,
    breakdown,
    buildup(8),
    drop2,
    outro,
  ],
});
