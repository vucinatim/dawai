import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `dawai init <name>` — scaffolds a song project: a tiny TypeScript
 * package whose song.ts is the source of truth, plus a generated
 * AGENTS.md that teaches any agent the format, the CLI, and the
 * edit → check → inspect → listen loop without reading dawai's repo.
 */

export function runInit(name: string): number {
  const directory = resolve(process.cwd(), name);
  if (existsSync(directory)) {
    console.error(`✗ ${directory} already exists.`);
    return 1;
  }
  const packagesDirectory = resolve(import.meta.dir, "../../..");

  mkdirSync(resolve(directory, "parts"), { recursive: true });
  mkdirSync(resolve(directory, "samples"), { recursive: true });

  writeFileSync(
    resolve(directory, "package.json"),
    `${JSON.stringify(
      {
        name,
        version: "0.0.0",
        private: true,
        type: "module",
        dependencies: {
          "@dawai/composer": `file:${resolve(packagesDirectory, "composer")}`,
          "@dawai/core": `file:${resolve(packagesDirectory, "core")}`,
        },
        // composer's own @dawai/core dep is workspace:*, which cannot
        // resolve outside the dawai repo — pin the transitive dep too.
        overrides: {
          "@dawai/core": `file:${resolve(packagesDirectory, "core")}`,
        },
        devDependencies: { typescript: "^5.9.3" },
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    resolve(directory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          lib: ["ESNext"],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
          verbatimModuleSyntax: true,
        },
        include: ["*.ts", "parts/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(resolve(directory, ".gitignore"), "node_modules/\n");
  writeFileSync(resolve(directory, "song.ts"), STARTER_SONG);
  writeFileSync(resolve(directory, "AGENTS.md"), agentsManual(name));

  console.log(`✓ Created ${name}/`);
  console.log(`  cd ${name} && bun install`);
  console.log("  dawai check          # the build gate");
  console.log("  dawai open           # start the live preview server");
  return 0;
}

const STARTER_SONG = `import { arp, chords, melody } from "@dawai/composer/builders";
import { limiter, ott, reverb } from "@dawai/composer/fx";
import { drums, kit, sampler, synth } from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { bus, duck, song, track } from "@dawai/composer/song";

const standardKit = kit("dnb-standard");

const beat = drums(standardKit, {
  kick: "x...x...x...x...",
  snare: "....x.......x...",
  chh: "x.x.x.x.x.x.x.x.",
});

const bassline = melody("A1 ~ ~ . F1 ~ ~ . C2 ~ ~ . G1 ~ G1 .", { step: 1 });
const progression = chords(["Am7", "Fmaj7", "Cmaj7", "G"], { beats: 4 });
const sparkle = arp("Am7", { style: "updown", step: 0.25, octaves: 2 });

export default song({
  name: "New Song",
  tempo: 120,
  timeSignature: [4, 4],
  tracks: [
    track("drums", sampler(standardKit), { gain: -4, out: "drumbus" }),
    track("bass", synth("sub-sine"), {
      gain: -5,
      duck: duck({ trigger: "drums:kick" }),
    }),
    track("keys", synth("keys"), { gain: -8, fx: [reverb(0.25)] }),
    track("arp", synth("pluck"), { gain: -12, pan: 0.2 }),
  ],
  buses: { drumbus: bus({ fx: [ott({ amount: 0.4 })] }) },
  master: [limiter(-1)],
  arrangement: [
    section("intro", 4, { keys: progression, arp: sparkle }),
    section("groove", 8, {
      drums: beat,
      bass: bassline,
      keys: progression,
      arp: sparkle,
    }),
  ],
});
`;

function agentsManual(name: string): string {
  return `# ${name} — a dawai song project

This folder is a **song as source code**. \`song.ts\` default-exports
\`song({ ... })\`; compiling means executing it. You (the agent) are the
editor: edit the TypeScript, and the running preview hot-reloads without
stopping playback. Git is undo — commit as you go.

## The loop

1. Edit \`song.ts\` (or split patterns into \`parts/*.ts\`).
2. \`dawai check\` — typecheck + compile + validation. Fix what it says.
3. \`dawai inspect\` — read back what you built (see views below).
4. The human listens in the preview (\`dawai open\`); \`dawai status --json\`
   tells you what they selected and where the playhead is.

## CLI

- \`dawai check [--json] [--skip-typecheck]\` — the build gate (exit 0/1)
- \`dawai inspect\` — arrangement grid; \`--track <id> [--bars a..b]\` note
  detail; \`--mix\` signal flow; \`--stats\` totals; \`--json\` full Document
- \`dawai open [--port 4400]\` — start the live server + preview
- \`dawai play [--from <bar>]\` / \`dawai stop\` — drive the connected preview
- \`dawai status --json\` — compile state, playhead, user selection

## Format cheat sheet

Time is in **beats** (floats; 4 beats = 1 bar at 4/4). Bars are 1-based.
Pitch is a MIDI number or a note name ("C4" = 60, scientific pitch).
Velocity 0–127. **Compiles must be deterministic** — never Math.random
or Date.now; use the seeded helpers.

\`\`\`ts
// Builders (@dawai/composer/builders)
notes([[0, "C2", 0.5, 100], ...])          // raw floor: [start, pitch, len, vel]
steps("x.o.X...", "C2")                    // drum grid: x hit, X accent, o ghost, . rest (16ths)
chords(["Am7", "F"], { beats: 4, octave: 3 })
melody("E3 ~ . G3", { step: 0.5 })         // ~ ties, . rests
arp("Am", { style: "updown", octaves: 2 })
euclid(3, 8, "C2")

// Combinators (@dawai/composer/combinators)
seq(a, b)  stack(a, b)  repeat(p, 4)  transpose(p, 12)  slice(p, 0, 4)
every(4, base, fill)  swing(p, 0.4)  velocity(p, 0.8)
humanize(p, { seed: 7 })  vary(p, { seed: 7, amount: 0.4 })

// Drums against a kit's pads (@dawai/composer/instruments)
drums(kit("dnb-standard"), { kick: "x...x...", snare: "....x..." })
// dnb-standard pads: kick rim snare clap chh phh ohh crash ride perc1 perc2 shaker

// Instruments (presets are layered voices with moving filters)
synth("sub-sine" | "reese" | "fat-saw" | "supersaw" | "warm-pad" | "pluck" |
      "keys" | "bell" | "hoover" | "stab" | "riser-noise" | "arp-saw")
synth("reese", { "filter.cutoff": 500, "filterEnvelope.octaves": 3 })  // param overrides
customVoice({ layers: [...], amp, filter, filterEnvelope, drive, chorus })  // your own synth
sampler(kit("dnb-standard" | "tr-909"))

// Mixing (gain in dB; fx envelopes in seconds; musical times in beats)
track("bass", synth("sub-sine"), { gain: -4, pan: 0, out: "musicbus", fx: [...],
  duck: duck({ trigger: "drums:kick", amount: -6, release: 0.5 }) })
bus({ gain: -2, fx: [compressor({ ratio: 4 })] })     // song({ buses: { musicbus: ... } })
filter("lowpass", 900)  eq({ low: 1 })  compressor({...})  distortion(0.3)
chorus({...})  reverb(0.3)  delay({ time: 0.75 })  limiter(-1)
ott({ amount: 0.5, gain: 2 })   // multiband glue — put on drum/music buses

// Sections + automation (@dawai/composer/section, /automation)
section("drop", 16, { drums: beat, bass: riff }, {
  automation: [automate("bass.fx.filter.cutoff", ramp(bars(16), 400, 8000, "exp"))],
})
// Transitions (@dawai/composer/idioms) — one-liners in section parts.
// riser/sweep need their track's first fx to be a filter:
//   track("fx", synth("riser-noise"), { fx: [filter("bandpass", 500, 1.5)] })
fx: riser(32)                          // rising build into a drop
fx: sweep(8, { holdBeats: 128 })       // falling release after the drop hits
impacts: impact(standardKit, { holdBeats: 128 })  // downbeat boom (sampler track)
// holdBeats = section length in beats, so one-shots don't tile.

// Parts can carry their own automation with self.* targets:
// section("build", 8, { bass: { pattern: riff, automation: [
//   automate("self.fx.0.cutoff", ramp(32, 400, 8000, "exp"))] } })

// Patterns shorter than a section tile (loop) to fill it.
// arrangement: [intro, buildup, drop] — sections play in order.
\`\`\`

## Conventions

- Reuse = plain TypeScript: patterns are values, components are functions.
- Sections are the primary surface; \`pattern.at(bar)\` on a track's
  \`clips\` is the absolute-placement floor.
- The preview is read-only; every change happens here, in source.
`;
}
