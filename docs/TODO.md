# TODO

Living backlog, roughly ordered inside each group. Feature *goals* still
get a spec in `docs/goals/` when they start; this file tracks everything
smaller and the queue itself. (Substrate goals 1–3: done.)

## UI polish (quick fixes — DONE 2026-07-18)

- [x] Fit-to-width default zoom: short songs should span the viewport;
      lane backgrounds/grid extend across the full visible area.
- [x] Track headers: the entire rectangle selects the track (not just
      the name), S/M toggles still click independently.
- [x] Bus + master rows in the arrangement (Ableton-style): tracks
      cluster under the bus they route to; rows are clipless,
      selectable → open their chain in the device panel.
- [x] Piano roll playhead: transform-driven line when the playing
      position is inside the selected clip.
- [x] Pinch-zoom bug: React's `onWheel` is passive so `preventDefault`
      can't stop macOS page zoom — attach a native non-passive wheel
      listener for ctrl/pinch zoom.
- [x] Follow-playhead mode (toggle in control bar; auto-scroll keeps
      the playhead in view, Ableton-style).
- [x] Transport controls top-center in the control bar.

## UI features

- [ ] Automation view: read-only lane curves per track (expandable
      under the lane, Ableton-style), rendered from Document automation
      including compiled duck curves.
- [ ] Sound browser (own goal): panel to audition every preset and kit
      pad in isolation; later swap instruments per track, then upload/
      import — pairs with the sample-library work.

## Sound quality (strategy + order in docs/sound-design.md)

1. [x] **L1 synthesis + mixing sprint**: moving filter envelopes,
       layered custom voices, reese/supersaw recipes, upgraded drum
       voices, OTT-style multiband bus glue, transition idioms
       (`riser`/`sweep`/`impact`, richer fills), duck tuning;
       re-author Neon Rain as the benchmark. (Goal 4 — CLOSED, pass.
       Listening verdict: sound clearly fuller; the bottleneck moved
       to composition/melody craft — see below.)
2. [ ] **Sample playback + curated CC0 starter library** (hybrid
       thesis: drums/FX from samples, tonal layer from synthesis);
       sound browser as the human swap surface; later
       `dawai samples search/get` (Freesound).
3. [ ] **`dawai render --out mix.wav` + analysis** — the numeric ears:
       LUFS, spectral balance, crest factor, reference matching; plus
       `dawai analyze` (key inference, clash detection, density).
4. [ ] **Resampling primitive**: `resample(pattern, throughChain)` via
       deterministic OfflineAudioContext render at compile-render time.
5. [ ] **L2/L3 synth engine** (AudioWorklet → Faust/WASM; Vital as the
       ceiling reference) — its own epic.

## Composition / musicality craft (new bottleneck after goal 4 —
   the sound is fuller but Neon Rain v2's arrangement and melodies
   were judged messy; the weakest link is now what gets written, not
   how it sounds)

- [ ] Melody/harmony craft: stronger motif discipline (theme, repeat,
      vary), tension-release phrasing, call-and-response between
      tracks; possibly composer helpers (motif(), answer(), cadence()).
- [ ] Arrangement clarity: fewer elements at once, register separation,
      frequency-slot planning per section (who owns lows/mids/highs),
      intentional space — less is more as an authoring guideline in
      the generated AGENTS.md.
- [ ] Reference-informed authoring checklists per genre (dnb first).

## Product direction: user editability (staged; boundary 1 already
   anticipates it — every edit writes through the source)

- [ ] **E1 — write-through value edits**: gain/pan/mute, fx params,
      tempo. UI gesture → server edit endpoint → deterministic AST
      patch of the literal in song.ts → watcher → recompile. Start
      with header volume drag.
- [ ] **E2 — literal-pattern edits**: automation points and notes that
      trace to literal builders (`notes()`, `steps()` grids).
- [ ] **E3 — agent-mediated gestures**: edits to combinator-produced
      material (can't map to source literally) become structured
      intents the agent applies ("move this note up a semitone") —
      keeps abstractions alive and the agent in the loop.
- [ ] Enabler for E2/E3 precision: compile with provenance (source
      locations attached to Document values) — additive IR metadata.

## Extensibility / plugin layer (design intent — shape for it now,
   build later; the composition layer is ALREADY open: patterns,
   combinators, generators, and toolkits are plain TS modules any song
   can import, e.g. a published `dawai-liquid-toolkit`)

- [x] During the L1 sprint: renderer instrument/fx construction becomes
      registry-driven internally (table, not switch) — the future
      plugin registry is then just external entries.
- [x] Song-level custom presets/kits as validated data (inline preset
      definitions in the IR, not just built-in ids) — 80% of "custom
      synths" for solo users. (`customVoice()`; kits still built-in.)
- [ ] Full plugin layer when dawai-as-dependency demands it: plugin =
      module exporting a descriptor (id + zod params schema → IR
      `{ type: "plugin", pluginId, params }` variant) + a renderer
      factory; server serves plugin bundles, UI dynamic-imports and
      registers; `dawai plugin new` scaffold; documented in generated
      AGENTS.md (the typical plugin author is an agent).

## Someday / ideas

- [ ] Parameterized songs (`song((params) => ...)`) — runtime inputs,
      Remotion-props style.
- [ ] `dawai render --out mix.wav` (OfflineAudioContext via the
      preview) → agent auditory feedback through multimodal analysis.
- [ ] Desktop packaging (Tauri).
- [ ] Non-4/4 support surfaced in UI/idioms.
- [ ] MCP wrapper over the CLI/HTTP surface.
