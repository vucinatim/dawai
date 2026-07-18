# Goal 1 — The Compiler

> The headless substrate: monorepo foundation, the complete IR, the
> composer authoring API, and the standalone CLI (`check`, `inspect`).
> No UI, no audio, no server. When this goal is done, a song is a real,
> tested, deterministic compilation pipeline.

Authority docs: [architecture.md](../architecture.md),
[composer-design.md](../composer-design.md). On any conflict, fix the
docs or the code — never let them drift.

## Scope

### Monorepo foundation
- Bun workspaces (`packages/*`), shared tsconfig, Biome, `bun test`
  wired at root. Strict TypeScript everywhere.
- `docs/current-state.md` updated as things land.

### packages/core — the IR
The **complete** Document schema in zod (core is the single authority;
composer/server/ui/cli import from it):
- Song meta: name, tempo, `timeSignature: [n, d]`, section markers
  (name, start, length — kept for inspect/UI/selection).
- Tracks: id, name, instrument ref (`synth` preset / `sampler` kit /
  `sample` clip source), mix (gain dB, pan, mute, `out` route),
  fx chain (typed params per fx: filter, eq, compressor, distortion,
  chorus, reverb, delay, limiter).
- Buses (id, fx, gain) and master chain.
- Clips: id, start (beats, absolute), length, note tuples
  `[start, pitch, length, velocity]` (clip-relative, MIDI numbers).
- Automation lanes: stable target path, `{ beat, value, curve }` points.
- Pure utilities: beats/bars math, note-name ↔ MIDI, per-track/section
  density stats (feeds inspect).

### packages/composer — the authoring API
- `song`, `track`, `section`, `seq` arrangement; absolute `.at()` floor.
- Pattern builders: `notes`, `steps` (x/X/o/. per 16th), `chords`,
  `melody`, `arp`, `euclid`.
- Combinators: `seq`, `stack`, `repeat`, `transpose`, `slice`, `every`,
  `swing`, `velocity`; seeded `humanize`/`vary` (determinism is a hard
  boundary — no unseeded randomness anywhere).
- Instruments: synth preset registry (sub-sine, reese, fat-saw,
  supersaw, warm-pad, pluck, keys, bell — params as data only),
  sampler kits, `sample()` clips (repitch metadata only).
- Mixing: fx constructors, `bus`, master, `duck` (compiles trigger
  note events → gain automation lane).
- Automation: `automate`, `ramp`.
- `compile(songValue) → Document` — pure, deterministic, precise errors.

### packages/cli — standalone half
- `dawai check`: tsc + compile + IR validation; stable exit codes;
  `--json`; errors name the fix.
- `dawai inspect`: arrangement grid (density glyphs + section ruler),
  `--track <id> [--bars a..b]` note detail with note names, `--mix`
  signal-flow table, `--stats`. Pure Document analysis via core.

### Fixtures
- The DnB demo song source (sections, step-string drums, layered bass,
  automation, duck, buses) as the primary fixture, plus minimal edge
  fixtures (empty song, single track, invalid songs for error paths).

## Acceptance criteria
- [x] `bun test`, typecheck, and lint green at root (100 tests).
- [x] Determinism test: compiling the demo song twice yields
      byte-identical Documents (seeded humanize included) — plus a
      cross-execution test (two fresh CLI runs, byte-identical output)
      that catches source-level nondeterminism the in-memory test can't.
- [x] Golden snapshots: demo Document JSON + every `inspect` view.
- [x] `duck` unit tests: known kick pattern → exact automation curve,
      including release truncation on overlapping triggers.
- [x] Error-path tests: invalid songs fail `check` with precise,
      actionable messages (bad pitch range, overlapping clip ids,
      unknown bus route, unseeded-randomness guard — the guard poisons
      Math.random/Date.now/performance.now during song execution).
- [x] Every architecture.md boundary that applies (1, 4) is enforced by
      code or test, not convention (`boundaries.test.ts` scans pure
      packages for forbidden imports/globals/deps; the determinism
      guard enforces boundary 4 at `check` time).
- [x] `docs/current-state.md` reflects reality.

## Validation
Run the `goal-validate` workflow with `{ "goal": "docs/goals/goal-1-compiler.md" }`;
triage confirmed findings to zero or explicit accepted-risk notes here.

### Triage record (2026-07-18)

The workflow (27 agents: 4 lenses + adversarial verification) confirmed
21 findings: 3 blockers (one root cause), 12 should-fix, 6 nits.
Disposition: **19 fixed, 2 accepted** —

- **Fixed (blockers)**: the unseeded-randomness guard now exists
  (`composer/determinism.ts`), wraps song execution + compile in the
  CLI, and is proven by the `fixtures/nondeterministic-song` error-path
  test.
- **Fixed (selection)**: master-fx automation now resolves against one
  finalized chain everywhere; `ramp()` opens with a step point;
  melody ties can't cross rests; chords validate octave range
  musically; `slice`/`inspect --json`/`formatMinutes`/duck-selector
  fixes; boundary-enforcement test; edge fixtures; doc drift corrected.
- **Accepted 1** — `humanize`/`vary` default `seed` to 1 rather than
  requiring it: a deterministic default is deliberate API design; the
  guard catches genuine nondeterminism.
- **Accepted 2** — time-unit split (beats for musical params, seconds
  for DSP envelopes) kept, now documented as an explicit convention in
  composer-design.md rather than renaming params.
- **Known limitation**: the guard poisons Math.random/Date.now/
  performance.now but not every conceivable nondeterminism source
  (e.g. argless `new Date()`, IO in song source). The cross-execution
  determinism test is the second net; full sandboxing is a goal-3
  server concern.
