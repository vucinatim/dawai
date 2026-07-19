# Current state

**SUBSTRATE GOALS 1–3 COMPLETE + GOAL 4 (L1 SOUND) BUILT** — gates
green (114 tests, tsc, biome), each goal with a validation record in
its spec under `docs/goals/`. The product works end to end: edit
`song.ts` while the song plays and the preview hot-swaps at the next
bar without stopping. Goal 4's objective validation passed (audition
probe: nothing silent, no clipping, filter movement measured); the
human listening rounds are the remaining gate.

## What exists and works

- **Monorepo**: bun workspaces (`packages/*`, `fixtures/*`), strict
  TypeScript (single root `tsc --noEmit`), Biome, `bun test`. All three
  gates green: 114 tests, 0 type errors, 0 lint errors. Purity
  boundaries enforced by test (`boundaries.test.ts`); the determinism
  guard (`composer/determinism.ts`) fails `check` on Math.random/
  Date.now/performance.now in song source.
- **`@dawai/core`** — the IR: complete zod Document schema (tracks,
  clips, note tuples, synth/sampler/sample/inline-voice instruments,
  9 fx types incl. `ott`, buses, master, automation lanes, section
  markers), **voice schema v2** (`voice.ts`: layered osc/fm/noise
  voices, amp + filter envelopes with octaves of movement, drive/
  chorus color; dotted-path param overrides via `resolveVoice`),
  `validateDocument()` with cross-cutting invariants and
  fix-naming error messages, note-name/MIDI + bars/beats utilities,
  density/stats analysis, and the four inspect text views
  (arrangement grid, track detail, mix, stats). 12 synth presets and
  sampler kits ship as data (`presets.ts`, `kits.ts`).
- **`@dawai/composer`** — the authoring API: `song`/`track`/`section`
  (+ `.with`/`.bars`), builders (`notes`, `steps`, `chords`, `melody`,
  `arp`, `euclid`, `drums`), combinators (`seq`, `stack`, `repeat`,
  `transpose`, `slice`, `every`, `swing`, `velocity`, seeded
  `humanize`/`vary`), fx constructors, buses, `duck` (compiles trigger
  notes → duck automation lane, release-truncation handled),
  `automate`/`ramp`/`bars`, and `compile()` → validated Document.
  Deterministic by construction (mulberry32, seeds only).
- **`@dawai/server`** — the live half: `CompileSession` (fresh
  subprocess per recompile via `compile-runner.ts` — Bun can't
  cache-bust in-process re-imports; last-good semantics), recursive
  watcher (debounced), WebSocket hub pushing documents/errors/transport
  and receiving throttled runtime snapshots, Hono HTTP
  (`/api/status|document|transport|health`), serves a built UI. Wire
  contract in `@dawai/core/protocol`.
- **`@dawai/cli`** — `check [--json] [--skip-typecheck]`, `inspect`
  (server-routed fast path, standalone fallback), `init <name>`
  (song-project scaffold: `file:` deps + overrides, starter song,
  generated AGENTS.md authoring manual), `open [--port]`,
  `play [--from <bar>]`, `stop`, `status --json`.
- **`@dawai/ui`** — the preview (Vite + React 19 + Tailwind 4 +
  shadcn mira preset, dark-only, kebab-case files): Ableton-style
  layout — control bar (transport, position, tempo, zoom), arrangement
  (canvas bar ruler with clickable section-loop chips, track lanes with
  canvas note mini-maps, playhead via direct transform, right-side
  headers with solo/listen-mute monitoring toggles), bottom detail
  panel (Device view: instrument/fx/mix modules + routing chips; Clip
  view: canvas piano roll). State: two zustand stores (document,
  runtime) with reducer actions + narrow selector hooks;
  `feedDocument` is the single Document write path (goal-3 WS seam).
  Audio: Tone.js engine (`src/audio/`) — **registry-driven** voice +
  fx construction (`voice-builder.ts`, `FX_FACTORIES`), layered
  voices with real filter envelopes, **drum voices v2** (layered
  kick/snare/impact recipes), OTT via MultibandCompressor, fx chains,
  buses, master limiter, automation lanes incl. duck and `self.*`
  part automation (risers/sweeps), seek via pause/reposition/resume,
  hot swap at the next bar without stopping the transport. Node-budget
  aware: kit tracks build only clip-used pads, lean 9-node chorus,
  layer polyphony capped (a WebAudio graph starves the render thread
  past a few thousand nodes). Space = play/stop. Dev probes:
  `__dawai.feedVariant()` / `.probe()` / `.audition()` (plays every
  preset + pad, reports peaks and filter-movement drift).
- **Fixtures**: `fixtures/dnb-demo` — "Neon Rain" v2, a 136-bar /
  ~3.1 min 8-track DnB arrangement (risers into both drops, impacts,
  OTT bus glue, tuned duck), with golden snapshots (Document + all
  four views), an in-memory determinism test, and a cross-execution
  determinism test (two fresh CLI runs byte-identical). The breaks
  track is a synthesized layer (no sample playback in v0).
  `fixtures/sound-tour` — walks all 12 presets and all 13 kit pads in
  labeled sections (the listening checklist). Edge fixtures:
  `invalid-song` (validate-stage failure), `minimal-song` (empty
  timeline), `nondeterministic-song` (determinism-guard failure).

## Conventions locked in goal 1

- Scientific pitch: C4 = MIDI 60 (matches Tone.js).
- `.at(bar)` and `--bars` ranges are 1-based; beats are 0-based floats.
- Automation semantics: segment uses the end point's curve; equal-beat
  points jump; lanes shadow static values; `ramp()` starts with a step.
- Package imports are subpath-only (`@dawai/core/document`) — no barrel
  exports anywhere.

## Next

Goal 4's human listening rounds (sound-tour + Neon Rain v2, per-sound
keep/fix verdicts, iterate via hot reload). Then, in order of audible
payoff (see docs/sound-design.md delivery order): sample playback + a
CC0 starter library + sound browser (goal 5), `dawai render` + numeric
ears (goal 6), resampling primitive, automation-lane UI, E1
editability.
