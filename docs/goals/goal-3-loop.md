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
- [ ] Scripted end-to-end test: start server on a fixture project →
      edit a source file → assert the updated Document arrives over
      WebSocket; break the file → assert last-good retained + error
      pushed; fix it → assert recovery.
- [ ] Hot swap during playback: transport does not stop, swap lands at
      the bar boundary (manually verified with the demo song).
- [ ] `dawai init` output compiles and plays out of the box; its
      generated AGENTS.md is sufficient for a fresh agent session to
      author a change without reading dawai's own repo.
- [ ] Full CLI surface from architecture.md works with `--json` and
      stable exit codes.
- [ ] The live demo: an agent session in a song folder is told "write a
      four-bar melancholic chord progression at 90 BPM" and the result
      appears and plays without a manual reload.
- [ ] Typecheck, lint, tests green; `docs/current-state.md` updated.

## Validation
Default (budget-conscious): gates green + hands-on verification of every
acceptance criterion (scripted e2e + the live demo as the human
acceptance test), recorded here. The `goal-validate` workflow (slimmed:
1 reviewer + capped blocker verification) runs only on explicit request.

## After this goal
Substrates are complete. Feature work begins on top, driven by the
drum & bass Tier-2 checklist in composer-design.md.
