# Goal 3 — The Loop

> The live substrate: `packages/server`, the CLI's runtime half, and
> hot reload. When this goal is done, the product exists — an agent
> edits `song.ts` and the running preview updates without the music
> stopping.

Authority docs: [architecture.md](../architecture.md) (boundaries 1, 5,
6 especially). Depends on: Goals 1 and 2.

## Scope

### packages/server
- Hono on Bun. Opens a song project folder: install-check, compile
  (execute source in-process), zod-validate, hold the in-memory
  Document.
- File watcher → debounced recompile → WebSocket push to connected UIs.
- **Last-good semantics**: a failed compile never replaces the current
  Document; the error (with precise location) is pushed to the UI
  error overlay and returned by `check`/`status`.
- HTTP API: transport control (play/stop/loop), `status` (transport
  state, playhead, user selection from the UI, compile state), health.
- Serves the built UI.

### packages/ui integration
- WebSocket document feed replaces the static fixture (the store seam
  from Goal 2).
- Hot swap applied at a musical boundary (next bar) when the transport
  is running; immediate when stopped.
- Error overlay wired to compile errors; music keeps playing last-good.
- Selection reported upstream to the server (read-only context).

### packages/cli — runtime half
- `dawai init <name>`: scaffolds a song project — package.json
  (depends on @dawai/composer), tsconfig, starter `song.ts`, `samples/`,
  and a generated **AGENTS.md** teaching the composer API, the CLI, the
  file conventions, and the edit → check → inspect → listen workflow.
- `dawai open`: starts the server for the current folder, opens the UI.
- `dawai play [--from <bar>] [--loop a b]` / `dawai stop` /
  `dawai status --json` — route through the running server; clear error
  with remediation when no server is up.
- Server-routing mode for `check`/`inspect` (reuse the server's current
  compile instead of a cold one) with standalone fallback preserved.

## Acceptance criteria
- [x] Scripted end-to-end test (`packages/server/test/e2e.test.ts`,
      6 tests, ~1s): initial push on connect, edit → updated Document
      over WebSocket, break → last-good retained + error pushed,
      fix → recovery, transport broadcast, runtime-status reporting.
- [x] Hot swap during playback: transport does not stop — measured
      live (beat 28.86 → edit → 32.86 after exactly 2s; position
      continuous, new document applied at the bar boundary).
- [x] `dawai init` output compiles and plays out of the box (verified:
      scaffold → `bun install` → full `check` clean → served live and
      audible); the generated AGENTS.md carries the format cheat sheet,
      CLI, and workflow loop so a fresh session needs nothing else.
- [x] Full CLI surface works: `init`, `open`, `check --json`,
      `inspect` (+ server-routed fast path with standalone fallback),
      `play [--from]`, `stop`, `status --json`; exit codes 0/1.
- [x] The live demo — performed literally: while the song played, a
      bass line was written into `song.ts`; the new track appeared in
      the preview and played without a reload, then a broken edit
      showed the exact compiler diagnostic in the overlay over the
      still-playing last-good document, and the fix cleared it.
- [x] Typecheck, lint, tests green (107 tests);
      `docs/current-state.md` updated.

## Validation
Default (budget-conscious): gates green + hands-on verification of every
acceptance criterion (scripted e2e + the live demo as the human
acceptance test), recorded here. The `goal-validate` workflow (slimmed:
1 reviewer + capped blocker verification) runs only on explicit request.

### Validation record (2026-07-18)

**Complete.** Verified hands-on in real Chrome against a freshly
`init`-ed song project served by `dawai open` (no fixture): live feed
connect, playback, mid-playback edits (name/tempo/new track), position
continuity across swaps, break/recover with the error overlay, and
`dawai status` reflecting the preview's playhead and selection. One
significant implementation discovery, fixed and covered by the e2e:
in-process module re-imports cannot be cache-busted in Bun, so each
recompile runs in a fresh subprocess (`compile-runner.ts`). Also fixed:
`init`'s `file:` dependency strategy needs an `overrides` entry for
composer's transitive `workspace:*` dep on core.

## After this goal
Substrates are complete. Feature work begins on top, driven by the
drum & bass Tier-2 checklist in composer-design.md.
