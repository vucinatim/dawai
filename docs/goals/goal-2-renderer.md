# Goal 2 — The Renderer

> The preview substrate: `packages/ui` renders a Document visually and
> audibly with transport controls. Fed a static fixture Document from
> Goal 1 — no server, no watching, no editing. When this goal is done,
> the demo song looks like a DAW and sounds like a track.

Authority docs: [architecture.md](../architecture.md) (boundaries 2, 3,
5 especially), [composer-design.md](../composer-design.md).
Depends on: Goal 1 (core types + demo Document fixture).

## Scope

### Design direction
**Mimic Ableton Live's arrangement view as closely as our model allows.**
Slick, dense, minimal, professional; dark theme only in v0. Stack:
shadcn/ui initialized with the dense preset **`--preset b1D0dv72`** on
Tailwind 4. Implementation must be driven by the `/ui-design` skill
(product-UI craft) and the `/shadcn` skill (preset init, registry,
theming mechanics). Density is a feature: small type, tight spacing,
no decorative chrome — a tool, not a landing page.

Layout (Ableton mapping):
- **Top — control bar**: play/stop, position readout (bar.beat), tempo,
  time signature, loop region. One slim, dense row.
- **Center — arrangement**: bar ruler with section markers (Ableton's
  locators) above stacked track lanes with clip blocks (note-density
  visualization); horizontal scroll + zoom across the full track;
  **track headers on the right, Ableton-style** (name, instrument
  badge, gain readout, and interactive **solo / listen-mute toggles** —
  runtime monitoring state driving renderer gains, never the Document;
  authored `mute` from source renders as a visually distinct state).
- **Bottom — detail panel**, toggling like Ableton's:
  - **Device view**: the selected track's instrument + fx chain laid
    out horizontally as device modules (params read-only), plus bus
    routing; selecting a bus or master shows its chain.
  - **Clip view**: the selected clip's piano roll (canvas-based — must
    stay smooth on the full demo song); read-only.

### App shell
- Vite + React 19 + Tailwind 4 + shadcn/ui (dense preset) + Zustand.
  Document store holds the fixture Document; designed so Goal 3 can
  swap in WebSocket-fed documents without touching components (store is
  the seam).
- Runtime-state store kept strictly separate from the Document store:
  playhead, transport state, selection, solo. Ephemeral, never persisted.
- **State management pattern (all UI state):** Zustand with
  reducer-style actions defined in the store — components never mutate
  state ad hoc, they dispatch named store actions. Components subscribe
  via narrow selectors. **Zero prop drilling**: state and actions are
  never threaded through intermediate components as props; if a
  component needs state, it reads the store. Props are for local,
  presentational data only.
- Error overlay component (built now, wired to live compile errors in
  Goal 3).
- Read-only selection: user can select a track / clip / bar range;
  selection drives the detail panel and lives in runtime state (Goal 3
  exposes it via `status`).

### Audio rendering (Tone.js, quarantined here)
- A document-to-audio renderer module: builds Tone nodes from the
  Document (synth presets, sampler kits, track gain/pan, fx chains,
  buses, master limiter, automation lanes including duck-generated
  ones).
- **Kit pads are synthesized voices, not sample files** (decision
  2026-07-18): kick/snare/hats/etc. via drum synthesis — zero binary
  assets, deterministic, no licensing. The kit's pad→pitch mapping in
  core stays the contract; the renderer maps pads to synthesis recipes.
- `sample()` audio-clip playback (real files, repitch) moves to Tier 2
  with the sample-library work; as part of this goal the demo song's
  `breaks` track is swapped to a synthesized equivalent so the fixture
  is fully audible.
- Lookahead-scheduled transport: play/stop, play-from, loop region;
  playhead position streamed to runtime state.
- Renderer is disposable/rebuildable from a new Document (the hot-swap
  seam Goal 3 relies on) — swapping documents must not require a page
  reload.

## Acceptance criteria
- [x] Demo Document renders correctly across all views (verified in
      Chrome: arrangement with note mini-maps, device chains, piano
      roll; human look-and-listen pass pending as the final judge).
- [x] The UI reads as a professional, dense, dark, Ableton-class tool:
      control bar top, arrangement center with right-side track
      headers, device/clip detail panel bottom.
- [x] Playback is audible, in time, and loop-stable — measured at the
      destination via a dev audio probe (intro peak 0.146, drop peak
      0.157, all-muted exactly 0); section-chip click sets the loop.
- [x] Zero editing code paths: `feedDocument` is the store's only write
      path and only the fixture feed module calls it (audited by grep;
      goal 3's WebSocket feed replaces that module).
- [x] State-management audit: reducer-style actions + narrow selector
      hooks; no component threads store state/actions down as props
      (only presentational iteration data like `trackId`/`clip`).
- [x] Tone.js imports exist only in `packages/ui` — enforced by
      `boundaries.test.ts` (scans core/composer/cli sources and
      manifests for tone).
- [x] Document swap hot-swaps audio without stopping the transport —
      verified live: 140 BPM variant fed mid-playback via the dev feed,
      transport stayed "started", audio kept flowing, header updated.
- [x] Piano roll stays smooth on the full demo song (canvas, drawn per
      selection/resize only; playhead moves via direct transform, no
      per-frame React renders).
- [x] Typecheck, lint, tests green (101 tests);
      `docs/current-state.md` updated.

## Validation
Run the `goal-validate` workflow with `{ "goal": "docs/goals/goal-2-renderer.md" }`;
then a human look-and-listen pass on the demo song. Triage findings to
zero or explicit accepted-risk notes here.
