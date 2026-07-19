# Goal 4 — The L1 Sound Sprint

> Make dawai sound *produced*: everything reachable without new tech
> (L1 of the depth ladder in [sound-design.md](../sound-design.md)) —
> voices with movement, layered drums, OTT glue, transition craft —
> plus the registry shaping that keeps the sound layer extensible.
> Benchmark: Neon Rain re-authored, judged by the human's ears.

Authority docs: [sound-design.md](../sound-design.md),
[composer-design.md](../composer-design.md),
[architecture.md](../architecture.md). Depends on goals 1–3.

## Scope

### 1. Core — voice schema v2 + IR additions (additive only)

- **Preset/voice schema v2**: a synth voice is a *stack of layers*,
  each layer = oscillator config (type, detune cents, octave shift,
  gain) + optional unison (voices/spread), plus a shared noise layer
  (type, gain, filter), filter (mode, cutoff, q) **with a filter
  envelope** (ADSR + octaves of movement — the single biggest reason
  things currently sound flat), amp envelope, and optional per-voice
  color fx (chorus/distortion amount). FM layers (harmonicity,
  modulation index) for bells/keys.
- **Inline custom voices**: `instrument.kind === "synth"` accepts a
  built-in preset id *or* a full inline voice definition — song-level
  custom synths as validated data (the extensibility promise, 80% of
  "custom synths" for users).
- **New fx type `ott`** (multiband upward/downward compression:
  depth, per-band amounts) — the defining glue of the reference sound.
- Preset/kit data stays in core as data; **registry-shaped**: renderer
  construction must key off tables, not switch statements.

### 2. Renderer — voices that move

- Registry-driven instrument + fx construction (table lookup; the
  future plugin registry is just external entries).
- **Layered voice builder** replacing bare `PolySynth(MonoSynth)`:
  layers built per voice-schema, filter envelopes actually routed,
  unison via fat oscillators, noise layers mixed in, FM layers via
  `FMSynth`. Voice-count budget kept sane (CPU).
- **Drum voices v2**: kick = pitch-envelope body + click layer +
  saturation; snare = crack + body + rattle layer; hats with metallic
  character; real crash/ride decay; velocity curves that make ghosts
  breathe.
- `ott` fx node via `Tone.MultibandCompressor`.
- Preset roster: upgrade all 8 existing presets onto schema v2; add
  up to 4 new (e.g. `hoover`, `stab`, `riser-noise`, `arp-saw`).

### 3. Composer — transition craft

- **Part-level automation with `self` targets**: section parts accept
  `{ pattern, automation }` where lanes may target `self.…` (resolved
  to the part's own track at compile). Enables self-contained idioms.
- **`riser(length, options)`** — sustained riser note + cutoff/pitch
  ramps as one placeable part. **`sweep()`** (downlifter),
  **`impact()`** (downbeat boom + sub drop). Richer `fill` idioms
  documented in the generated AGENTS.md.
- Duck defaults tuned so the pump is *audible* out of the box.

### 4. Fixtures + benchmark

- **`fixtures/sound-tour`** — a song that walks every preset and every
  kit pad in labeled sections (the listening checklist, and the seed of
  the future sound browser).
- **Neon Rain re-authored** to exploit everything: moving reese,
  risers into both drops, impacts on downbeats, OTT on the drum bus,
  tuned duck, fills that breathe. The demo song always showcases the
  current ceiling.
- `dawai init` starter song gets the same treatment in miniature.

## Sequence (each step gates-green + committed)

1. Core schema v2 + `ott` + inline voices (+ snapshot updates —
   deliberate IR additions).
2. Renderer: registries → layered voices → drum voices v2 → `ott`.
3. Composer: self-target part automation → riser/sweep/impact → duck
   defaults.
4. Fixtures: sound-tour → Neon Rain v2 → starter song.
5. Validation rounds (below) — iterate 2–4 from listening notes.

## Acceptance criteria

- [x] All gates green; IR changes additive (goal-1/2/3 tests still
      pass with only deliberate snapshot updates).
- [x] Renderer instrument/fx construction is registry-driven (no
      type-switch left in the build path).
- [x] An inline custom voice defined in a song project compiles,
      validates, and sounds (`customVoice` in sound-tour).
- [x] Automated audition probe: `__dawai.audition()` plays every
      preset and kit pad and reports per-sound peak/RMS — nothing
      silent, master never clips (peak < 0 dBFS with the limiter
      engaged).
- [x] Filter movement is audible on at least reese, pad, pluck, and
      supersaw (and visible in the probe as spectral change over a
      held note — coarse check via repeated FFT snapshots).
- [x] `riser`/`sweep`/`impact` are one-liner placements in a section
      and are documented in the generated AGENTS.md.
- [x] Neon Rain v2 uses risers, impacts, OTT, tuned duck, and fills;
      compiles deterministically; golden snapshots updated.

## Validation (ears-first, budget-conscious — no agent fleets)

1. **Pre-sprint tag**: tag the current commit (`v0-sound`) so the old
   renderer is one `git checkout` away for A/B reference.
2. **Objective pass (agent)**: gates + the audition probe in Chrome
   (nothing silent, no clipping, filter movement present, transport
   stable through Neon Rain v2 start-to-finish).
3. **Listening round (human)** — the real gate, structured to be
   cheap: play `sound-tour`, then Neon Rain v2, and give per-sound
   verdicts (*keep / fix: <one line>*) plus overall notes. The agent
   turns notes into parameter changes via hot reload; repeat rounds
   until the pass bar.
4. **Pass bar (human judgment)**: every sound-tour entry rated *keep*;
   Neon Rain v2 judged clearly better than v1 with transitions that
   feel produced; the duck pump plainly audible in the drops.
5. Validation record written here; TODO items ticked.

## Validation record — objective pass (2026-07-19)

Gates: 114 tests, `tsc`, `biome` all green. `dawai check` clean on
sound-tour (13 tracks, 52 bars) and Neon Rain v2 (8 tracks, 136 bars).

**Audition probe** (Chrome, M1 Pro): all 12 presets and all 13 kit
pads sound — `silent: []`. Peaks balanced (presets 0.14–0.43, pads
0.14–1.08 pre-track-gain; master peak 0.82 at the drop, no clipping).
Filter movement (spectral-centroid drift over held note): reese 0.57,
supersaw 0.31, warm-pad 2.80, pluck 0.15 — all four plainly moving.

**Bugs found and fixed by the probe + playback tracing:**

1. *MetalSynth pitch arg* — crash/ride triggered with
   `(duration, time, velocity)` but Tone v15 Monophonic takes
   `(note, duration, time, velocity)`: the decay was interpreted as a
   1.6 Hz note → subsonic silence. Types didn't catch it (`Frequency`
   accepts numbers). Fixed with an explicit 250 Hz strike note and
   recalibrated gains (crash −20 dB, ride −18 dB).
2. *Probe measurement* — single analyser snapshots (~43 ms window)
   missed short percussive sounds entirely; audition now polls
   peak/centroid across each sound's whole duration.
3. *WebAudio node-budget collapse* — the render thread starved
   (context clock at ~9% of realtime, silence mid-song) because the
   graph built ~3,900 nodes eagerly: every kit track instantiated all
   13 layered pad recipes (~780 nodes per kit), Tone.Chorus costs ~70
   nodes per voice instrument, and each MonoSynth voice costs ~50.
   Fixed: kit tracks only build pads their clips actually use (pitch
   set known at build time), Tone.Chorus replaced with a ~9-node
   dual-delay chorus, layer polyphony capped at 6. Buildup → drop
   transition now renders at 1.0× realtime throughout (was 0.16×).

Transport stability: drop looped 16 s at 1.0× realtime; buildup → drop
boundary (riser + impact + sweep + full drop spin-up) at 1.0×.

## Validation record — listening round (2026-07-19)

- **Sound Tour**: all presets and pads rated *keep* — no fixes
  requested.
- **Neon Rain v2**: sound judged clearly fuller than v1 (the L1
  sprint's goal); transitions and pump work. The *composition* was
  judged the new weak point — "messy, kinda shitty melody" — i.e. the
  bottleneck moved from sound quality to arrangement/melody craft.
  That is authoring-layer musicality, out of L1 scope, and now the
  headline item for future work alongside the sample goal.

**GOAL 4 CLOSED — pass.**

## Explicitly out of scope (queued behind this goal)

Sample playback + library (goal 5), `render`/numeric ears (goal 6),
resampling primitive, automation-lane UI, sound browser UI, L2/L3
engine work, E1 editability.
