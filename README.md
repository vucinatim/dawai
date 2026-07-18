# dawai

> A local-first digital audio workstation where the song is TypeScript
> source code, the app is the dev server + preview pane, and an AI agent
> is the editor. A code framework whose build output is a track, not
> software.

Think **Remotion for music**: the song project is a small TypeScript
package; compiling it means executing it to a validated JSON IR (the
Document); the dawai app renders that Document visually and audibly —
preview-only, Ableton-style — while the agent edits the source and the
running preview hot-reloads without the music stopping. Git is version
control *and* undo: branch a song, diff an arrangement, revert a bad
idea.

```ts
const drop = section("drop", 32, {
  drums: stack(
    drums(dnbKit, { kick: "x.........x.....", snare: "....x.......x..." }),
    humanize(drums(dnbKit, { chh: "x.x.x.x.x.x.x.x." }), { seed: 174 }),
  ),
  sub: melody("E1 ~ ~ . G1 ~ . A1 ~ ~ . C2 ~ B1 ~ .", { step: 0.5 }),
  pads: chords(["Em9", "Cmaj7", "Am7", "Bm7"], { beats: 8 }),
});
```

```
$ dawai inspect
bars    1       9       17      25      33      41      ...
section |intro          |buildup        |drop
drums   ................▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆████████████████
sub     ................................████████████████
pads    ██▇▇▇▇▇▇██▇▇▇▇▇▇██▇▇▇▇▇▇██▇▇▇▇▇▇██▇▇▇▇▇▇██▇▇▇▇▇▇
```

## How it works

| Codebase concept | dawai equivalent |
|---|---|
| Source files | Song folder (`song.ts`, `parts/*.ts`) |
| Framework | `@dawai/composer` — sections, patterns, combinators, mixing |
| Compile | Execute the song source → Document (zod-validated JSON IR) |
| Typecheck | `dawai check` (tsc + compile + validation) |
| Dev server + HMR | Local server: watch → recompile → live preview *(goal 3)* |
| Browser preview | Timeline, piano roll, transport — renders, never edits *(goal 2)* |
| Editor / IDE | The agent (Claude Code or any harness) |
| Version control & undo | Git, plain |

Read [docs/architecture.md](docs/architecture.md) (the constitution) and
[docs/composer-design.md](docs/composer-design.md) (the authoring
framework). Progress lives in [docs/current-state.md](docs/current-state.md).

## Status

All three substrate goals are complete — the loop works end to end:
edit `song.ts` while the song plays and the preview hot-swaps at the
next bar without stopping. Built: `@dawai/core` (the IR),
`@dawai/composer` (the authoring API), `@dawai/cli`
(`init`/`check`/`inspect`/`open`/`play`/`status`), `@dawai/server`
(watch → recompile → WebSocket push, last-good semantics), and
`@dawai/ui` (Ableton-style preview with a Tone.js renderer and
synthesized instruments) — 107 tests, deterministic compiles enforced
by a runtime guard. Next: sound quality (deeper synthesis, presets,
transition craft, sample playback).

```bash
bun install && bun test

# author a song
bun packages/cli/src/main.ts init my-song && cd my-song && bun install
bun ../packages/cli/src/main.ts open          # server on :4400
bun run --cwd ../packages/ui dev              # preview on :5173
# …edit song.ts and listen. dawai check / inspect / play / status all work.
```

## License

MIT © [Tim Vučina](https://github.com/vucinatim)
