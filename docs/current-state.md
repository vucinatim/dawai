# Current state

**Goals 1 (Compiler) and 2 (Renderer) COMPLETE** — gates green
(101 tests, tsc, biome); goal 1 validated by the agent-fleet workflow,
goal 2 by direct empirical verification + human pass (see validation
records in `docs/goals/`). Validation process is now budget-conscious:
gates + hands-on verification by default; the slimmed `goal-validate`
workflow only on explicit request. Goal 3 (Loop) not started.

## What exists and works

- **Monorepo**: bun workspaces (`packages/*`, `fixtures/*`), strict
  TypeScript (single root `tsc --noEmit`), Biome, `bun test`. All three
  gates green: 100 tests, 0 type errors, 0 lint errors. Purity
  boundaries enforced by test (`boundaries.test.ts`); the determinism
  guard (`composer/determinism.ts`) fails `check` on Math.random/
  Date.now/performance.now in song source.
- **`@dawai/core`** — the IR: complete zod Document schema (tracks,
  clips, note tuples, synth/sampler/sample instruments, 8 fx types,
  buses, master, automation lanes, section markers),
  `validateDocument()` with cross-cutting invariants and
  fix-naming error messages, note-name/MIDI + bars/beats utilities,
  density/stats analysis, and the four inspect text views
  (arrangement grid, track detail, mix, stats). Synth presets and
  sampler kits ship as data (`presets.ts`, `kits.ts`).
- **`@dawai/composer`** — the authoring API: `song`/`track`/`section`
  (+ `.with`/`.bars`), builders (`notes`, `steps`, `chords`, `melody`,
  `arp`, `euclid`, `drums`), combinators (`seq`, `stack`, `repeat`,
  `transpose`, `slice`, `every`, `swing`, `velocity`, seeded
  `humanize`/`vary`), fx constructors, buses, `duck` (compiles trigger
  notes → duck automation lane, release-truncation handled),
  `automate`/`ramp`/`bars`, and `compile()` → validated Document.
  Deterministic by construction (mulberry32, seeds only).
- **`@dawai/cli`** — `dawai check [dir] [--json] [--skip-typecheck]`
  (tsc + compile + validate, exit 0/1) and `dawai inspect [dir]`
  (arrangement grid default, `--track --bars`, `--mix`, `--stats`,
  `--json`). Standalone — no server exists yet.
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
  Audio: Tone.js engine (`src/audio/`) — synth presets via
  PolySynth(MonoSynth), **synthesized drum voices** for kit pads, fx
  chains, buses, master limiter, automation lanes incl. duck, seek via
  pause/reposition/resume, hot swap at the next bar without stopping
  the transport. Space = play/stop. Dev probes: `__dawai.feedVariant()`
  / `__dawai.probe()` (destination peak meter).
- **Fixtures**: `fixtures/dnb-demo` — "Neon Rain", a 136-bar / ~3.1 min
  DnB arrangement exercising the full surface, with golden snapshots
  (Document + all four views), an in-memory determinism test, and a
  cross-execution determinism test (two fresh CLI runs byte-identical).
  The breaks track is a synthesized layer (no sample playback in v0).
  Edge fixtures: `invalid-song` (validate-stage failure),
  `minimal-song` (empty timeline), `nondeterministic-song`
  (determinism-guard failure).

## Conventions locked in goal 1

- Scientific pitch: C4 = MIDI 60 (matches Tone.js).
- `.at(bar)` and `--bars` ranges are 1-based; beats are 0-based floats.
- Automation semantics: segment uses the end point's curve; equal-beat
  points jump; lanes shadow static values; `ramp()` starts with a step.
- Package imports are subpath-only (`@dawai/core/document`) — no barrel
  exports anywhere.

## Next

Goal 3: the live loop — server, watcher, hot reload, `init`/`open`
(`docs/goals/goal-3-loop.md`).
