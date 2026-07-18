# dawai — composer framework design

> How `@dawai/composer` makes a full 3–5 minute track intuitive, clean,
> and clever to write in TypeScript. Companion to
> [architecture.md](architecture.md) (the constitution); this doc owns
> the authoring model. Validation target: a complete instrumental
> drum & bass track (see checklist at the bottom).

## The authoring model

Three layers, each compiling into the one below. Authors (agents) work
as high as possible and drop down freely:

1. **Arrangement** — the song as a sequence of *sections*.
2. **Patterns** — reusable musical material placed by sections.
3. **Raw notes** — literal `[start, pitch, length, velocity]` tuples;
   the always-available floor.

### Sections: the primary surface

Producers think in sections (intro → buildup → drop → breakdown), and
that is where edit-locality lives: "make drop 2 harder" must be one
place in the code. A section declares its length and what each track
plays during it:

```ts
const drop1 = section("drop", 32, {    // named marker, 32 bars
  drums: stack(twoStep, ghostSnares),  // stack = layer patterns
  bass:  reeseRiff,
  pads:  chords(["Em9", "Cmaj7"], { beats: 8 }),
});                                     // tracks omitted here are silent

export default song({
  name: "Neon Rain",
  tempo: 174,
  timeSignature: [4, 4],
  tracks,                              // track definitions (instrument + mix), below
  arrangement: [intro, buildup, drop1, breakdown, buildup.bars(8), drop2, outro],
});
```

Sections compile to the track-centric IR (tracks → clips → notes);
the Document knows nothing about sections except as named markers
(kept for `inspect`, the UI ruler, and selection context). Absolute
placement (`pattern.at(barN)` on a track) remains available for
anything the section model doesn't fit.

### Patterns: values + combinators

A pattern is a plain value: a chunk of notes with a length in beats.
Reuse, variation, and "components" are just TypeScript — functions
returning patterns, parameterized however the author likes
(`dnbDrums({ ghosts: true, variation: 2 })`). The framework ships the
vocabulary:

- Builders: `notes([...])`, `steps("x..x ..x.", "C1")`,
  `chords(["Am7", "F"], { beats: 4 })`, `melody("E3 G3 A3 ~ B3", { step: 0.5 })`,
  `arp(chord, { style })`, `euclid(hits, steps, pitch)`
- Combinators: `seq(...)` (concatenate), `stack(...)` (layer),
  `repeat(p, n)`, `transpose(p, semitones)`, `slice(p, from, to)`,
  `every(n, p, variant)`, `swing(p, amount)`, `velocity(p, curve)`
- Seeded generativity: `humanize(p, { timing, velocity, seed })`,
  `vary(p, { seed, amount })` — deterministic per architecture
  boundary 4.

Pitch is `number | string` everywhere: MIDI numbers or note names
("E1", "F#3") — names preferred in source for readability; the IR
stores numbers.

**Step strings** (`"x..X ..o."` — hit / accent / ghost / rest, one char
per 16th by default) are the one sanctioned mini-notation: the
drum-machine grid is a universal idiom, the parser is regex-tier, and
the token savings for drum programming are enormous. It never grows
beyond hits/accents/ghosts/rests; anything smarter is a combinator.

## Tracks, instruments, sound sources

A track = name + instrument + mix settings + output route. One track
model; three instrument kinds:

```ts
const tracks = [
  track("drums",  sampler(kit("dnb-standard")), { gain: -3, out: "drumbus" }),
  track("breaks", sample("samples/amen.wav"), { gain: -8, out: "drumbus" }),
  track("sub",    synth("sub-sine"),    { gain: -4 }),
  track("reese",  synth("reese"),       { gain: -7, fx: [filter("lowpass", 900), distortion(0.3)] }),
  track("pads",   synth("warm-pad"),    { gain: -12, fx: [reverb(0.4)] }),
];
```

- **`synth(preset)`** — built-in subtractive presets (v0 set: sub-sine,
  reese, fat-saw, supersaw, warm-pad, pluck, keys, bell). Preset params
  overridable: `synth("reese", { detune: 0.4 })`. Rendered by Tone.js
  in the UI; the IR stores only `{ type, preset, params }`.
- **`sampler(kit)`** — one-shots mapped to names/pitches; drum
  programming is note programming. v0 kits are built-in only
  (`dnb-standard`, `tr-909`); song-local custom kits are
  designed-for-later.
- **`sample(file)`** — an audio file as pattern material placed on the
  timeline (breaks, loops, atmos). v0 stretch mode is `repitch`
  (playbackRate = tempo ratio — the classic jungle sound anyway);
  proper time-stretch is designed-for-later.

**Sample library strategy:** v0 ships a curated CC0 starter library
(~30 files: kicks, snares, hats, percs, two classic breaks, a few
atmos) resolved by id, plus whatever lives in the song's `samples/`.
Later: `dawai samples search/get` wrapping the Freesound API —
agent-operable sample acquisition as a CLI namespace, same shape as
everything else.

## Mixing: chains, buses, master

Signal flow is declarative data, uniform at every level:

```
track: instrument → fx[] → gain/pan → out (bus id | "master")
bus:               fx[] → gain     → master
master:            fx[] → limiter (always last)
```

```ts
export default song({
  ...,
  buses: { drumbus: bus({ fx: [compressor({ ratio: 4, attack: 0.003 }), eq({ low: -2 })] }) },
  master: [eq({ high: 1.5 }), limiter(-1)],
});
```

- **Gain in dB**, pan in [-1, 1]. Producers and agents both speak dB.
- **Unit convention for time-like params**: anything *musical* is in
  beats (duck release, delay time, automation positions); anything
  *DSP-envelope* is in seconds (compressor attack/release, reverb
  decay/predelay, chorus rate in Hz) — the audio-engineering
  convention for those knobs.
- v0 fx vocabulary (Tone.js-backed, declarative in IR):
  `filter`, `eq` (3-band), `compressor`, `distortion`, `chorus`,
  `reverb`, `delay`, `limiter`.
- **Ducking without DSP**: `duck({ trigger: "drums:kick", amount: -6,
  release: 0.25 })` on a track/bus compiles the trigger's *note events*
  into a gain-automation curve — deterministic sidechain pumping as
  pure data. Audio-keyed sidechaining never needs to exist.
- `mute` is authored data; **solo is runtime-only** (UI/transport
  state, never in source).

## Automation

Breakpoint lanes in the IR from day one — buildups are automation:

```ts
automate("reese.fx.filter.cutoff", ramp(bars(8), 400, 8000, "exp"))  // in a section
```

IR shape: `{ target, points: { beat, value, curve }[] }`, clip-relative
when authored in a section, resolved to absolute on compile. Targets
address track gain/pan, fx params, instrument params by stable path.

## Time signatures

The IR carries `timeSignature: [n, d]` and all combinators derive from
`bars(n)` rather than hardcoding ×4 — but v0 builds and tests against
4/4 only (the validation genre is 4/4). Cheap generality now, no
UI/groove investment until a real need shows up.

## The review loop: `dawai inspect`

`check` proves the song is *valid*; `inspect` shows the agent *what it
actually built* — compact, deterministic text renderings of the
compiled Document (pure core, no server needed):

- `dawai inspect` — **arrangement grid**: tracks × bars, density
  glyphs (`.` silent → `█` dense), section markers on the ruler. A
  whole 5-minute track's shape in ~15 lines.

  ```
  bars    1...... 9...... 17..............................49......
  section |intro  |build  |drop1                          |break
  drums   ........▂▄▆█████████████████████████████████████........
  sub     ................████████████████████████████████▂▂▂▂▂▂▂▂
  reese   ................████████████████████████████████........
  pads    ▅▅▅▅▅▅▅▅▅▅▅▅▅▅▅▅................................▅▅▅▅▅▅▅▅
  ```

- `dawai inspect --track reese --bars 17..21` — note detail with
  musical names: `17.0  E1  len 0.75  vel 100`.
- `dawai inspect --mix` — signal-flow table: every chain, gain, route,
  automation target.
- `dawai inspect --stats` — per-section density, pitch ranges, empty
  tracks. (Structural defects like overlapping clips are hard `check`
  errors, not stats.)

The agent's full loop: **edit source → `check` → `inspect` → compare
against intent → iterate**, with the human's ears and the UI as the
final judge. Future `analyze` (key inference, clash detection) joins
this same family.

## Validation target: the drum & bass checklist

A complete 3–5 min instrumental DnB track is the proof of concept.
Feature tiers, in build order:

**Tier 1 — first playable loop** (phases 1–3 of architecture.md):
sections + patterns + step strings; synth presets (sub, reese, pad);
sampler + starter kit; track gain/pan; `check`; `inspect`
(arrangement + track views).

**Tier 2 — the full track** (phase 5): fx chains, buses + group
compression, master limiter, automation + ramps, `duck`, `sample()`
breaks with repitch, seeded `humanize`, `inspect --mix/--stats`.

**Tier 3 — beyond the proof**: Freesound CLI integration, real
time-stretch, audio-keyed sidechain (only if `duck` proves
insufficient), non-4/4 grooves, `analyze`.

When an agent can be told "make me a 4-minute liquid DnB track at 174"
and the result has a real arrangement arc, a mixed drum bus, a pumping
bassline, and survives `inspect` review — the concept is proven.
