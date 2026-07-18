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

- [ ] All gates green; IR changes additive (goal-1/2/3 tests still
      pass with only deliberate snapshot updates).
- [ ] Renderer instrument/fx construction is registry-driven (no
      type-switch left in the build path).
- [ ] An inline custom voice defined in a song project compiles,
      validates, and sounds.
- [ ] Automated audition probe: `__dawai.audition()` plays every
      preset and kit pad and reports per-sound peak/RMS — nothing
      silent, master never clips (peak < 0 dBFS with the limiter
      engaged).
- [ ] Filter movement is audible on at least reese, pad, pluck, and
      supersaw (and visible in the probe as spectral change over a
      held note — coarse check via repeated FFT snapshots).
- [ ] `riser`/`sweep`/`impact` are one-liner placements in a section
      and are documented in the generated AGENTS.md.
- [ ] Neon Rain v2 uses risers, impacts, OTT, tuned duck, and fills;
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

## Explicitly out of scope (queued behind this goal)

Sample playback + library (goal 5), `render`/numeric ears (goal 6),
resampling primitive, automation-lane UI, sound browser UI, L2/L3
engine work, E1 editability.
