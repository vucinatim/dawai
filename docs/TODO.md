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

## Sound quality (composer-design Tier 2 — the audible-payoff queue)

- [ ] Deeper synthesis recipes + more/better presets (filter envelopes
      that move, FM recipes, tuned unison).
- [ ] Transition craft as composer idioms: `riser()`, sweeps, impacts,
      crash placement helpers; richer fills.
- [ ] Duck tuning (make the pump obvious by default in demos).
- [ ] Sample playback (`sample()` clips) + small CC0 starter library;
      later `dawai samples search/get` (Freesound).
- [ ] `dawai analyze` (key inference, clash detection, density).

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

## Someday / ideas

- [ ] Parameterized songs (`song((params) => ...)`) — runtime inputs,
      Remotion-props style.
- [ ] `dawai render --out mix.wav` (OfflineAudioContext via the
      preview) → agent auditory feedback through multimodal analysis.
- [ ] Desktop packaging (Tauri).
- [ ] Non-4/4 support surfaced in UI/idioms.
- [ ] MCP wrapper over the CLI/HTTP surface.
