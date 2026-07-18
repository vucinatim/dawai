# Current state

**Goal 1 (Compiler) COMPLETE** — implemented, gates green (100 tests,
tsc, biome), validated by the `goal-validate` workflow (21 confirmed
findings triaged: 19 fixed, 2 accepted — see the triage record in
`docs/goals/goal-1-compiler.md`). Goals 2 (Renderer) and 3 (Loop) not
started.

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
- **Fixtures**: `fixtures/dnb-demo` — "Neon Rain", a 136-bar / ~3.1 min
  DnB arrangement exercising the full surface, with golden snapshots
  (Document + all four views), an in-memory determinism test, and a
  cross-execution determinism test (two fresh CLI runs byte-identical).
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

Goal 2: the Ableton-style preview UI (`docs/goals/goal-2-renderer.md`).
