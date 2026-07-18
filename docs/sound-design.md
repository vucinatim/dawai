# dawai — sound-design strategy

> How dawai gets from "competent softsynth demo" to label-adjacent
> sound. Companion to composer-design.md; this doc owns the audio
> quality roadmap and its paradigms. Reference bar: modern dancefloor
> DnB (Sub Focus, Metrik, Grafix, Andromedik).

## Where rendering lives today

Tone.js v15 over the Web Audio API: transport/scheduling plus stock
instrument and fx nodes, configured by our presets. That is the
*highest* abstraction level available — and the current sound reflects
it. The architecture caps nothing: the Document/renderer split lets the
renderer descend the whole depth ladder without touching the paradigm.

## The depth ladder

- **L0 (now)** — stock Tone synths, preset-configured. Static filters;
  the reason things sound flat. Not even fully exploited yet.
- **L1 — custom voices from native nodes** (no new tech): multi-osc
  stacks with real detune/phase design, noise layers, moving filter
  envelopes, WaveShaper distortion stages, comb filtering for reese
  character, layered drum voices, transient shaping — and OTT-style
  multiband upward/downward compression via Tone's
  `MultibandCompressor`, the defining glue of modern electronic sound.
  **Huge headroom here; this is the current sprint.**
- **L2 — AudioWorklet**: per-sample DSP, the same floor VSTs live on.
  Custom wavetable oscillators, ZDF filters, true supersaws.
- **L3 — WASM**: real DSP compiled into the worklet. Pragmatic path:
  **Faust** (DSP language → AudioWorklet, pro-grade library).
  Existence proof of the ceiling: **Vital** (open-source Serum-class
  synth; presets are JSON — a future dawai wavetable engine could
  consume a preset ecosystem instead of hand-crafting patches).
  "Serum-lite in the browser" is an engineering budget, not a fantasy.

## The hybrid thesis (samples + synthesis)

Decomposition of the reference sound: **drums and FX ear-candy are
sample-dominated** (layered, mastered one-shots — matching them with
live synthesis is fighting uphill for no reason); **tonal identity is
synthesis** (reeses, supersaws, pads, plucks — usually resampled);
vocals are samples. Therefore:

- dawai ships a **curated, high-quality preset sample library**
  (drums, impacts, risers, sweeps, vox chops; CC0/licensed) that the
  agent composes against by id.
- **Synthesis carries the tonal layer** — where recipes and a future
  deeper engine actually compete.
- **Humans swap samples post-hoc** to taste (sound browser); the
  agent's workflow never blocks on sample choice.

## Resampling as a first-class primitive (the modern workflow)

Modern bass design is literally: synthesize → render to audio →
filter/distort the rendered audio → repeat. dawai can make that native
and **deterministic**: `resample(pattern, throughChain)` rendered via
OfflineAudioContext at compile-render time — same source, same audio,
cacheable. Neuro-grade movement without a Serum; no other agent-facing
tool has it. (Fits boundary 4: offline renders are deterministic.)

## The ears problem (honest constraint)

The recipes are documented craft knowledge — enough to get from flat to
legitimately good. The last 20% (correct → anthemic) is tuned by ear,
and the agent has none. Mitigations, in delivery order:

1. **Human ears + hot reload** — the iteration loop already built;
   producer notes → parameter changes in seconds.
2. **Numeric ears** — `dawai render --out mix.wav` + analysis: LUFS,
   spectral balance/centroid, crest factor, spectrograms, and
   **reference matching** (compare a drop's spectrum/dynamics against a
   reference track's). Objective targets the agent can iterate against
   alone. This is a sensory organ, not a nice-to-have.
3. Eventually: multimodal audio-model analysis of rendered output.

## Theory of victory (label-quality, in theory)

Hybrid samples+synthesis (this year's sound) → resampling primitive
(the modern workflow, deterministic) → analysis-driven iteration +
human ears (the feedback loop) → Faust/WASM DSP when Tone is outgrown
(the ceiling) → real mastering chain with loudness targets (the
finish). None of it requires re-architecting anything built so far.

## Delivery order

1. **L1 synthesis + mixing sprint** — moving filters, layered voices,
   reese/supersaw recipes, drum voice upgrades, OTT-style bus glue,
   transition idioms (`riser`/`sweep`/`impact`, richer fills), duck
   tuning; re-author Neon Rain as the benchmark.
2. **Sample playback + curated starter library** (+ sound browser as
   the human swap surface).
3. **`dawai render` + analysis** — the numeric ears.
4. **Resampling primitive.**
5. **L2/L3 synth engine (Faust path)** — its own epic.
