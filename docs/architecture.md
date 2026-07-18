# dawai — architecture (v0)

> A local-first digital audio workstation where the song is TypeScript
> source code, the app is the dev server + preview pane, and an AI agent
> is the editor. A code framework whose build output is a track, not
> software.

## Thesis

A DAW is fundamentally a document editor, and coding agents are the best
document editors ever built — but they are terrible at clicking transport
buttons and dragging clips. dawai resolves this by borrowing the paradigm
agents are strongest at: **the codebase**.

- The **song project** is a small TypeScript project — source code in the
  literal sense. It imports the dawai composer API and exports a song.
- **Compiling** the song means executing it (Bun) to produce the
  **Document** — a zod-validated JSON IR of tracks, clips, and notes.
- The **dawai app** is preview-only: it *renders* the Document (visually
  and audibly) and owns playback controls. It edits nothing.
- The **agent** (Claude Code or any harness, opened in the song folder)
  is the editor. It edits the source and uses a small CLI for everything
  that isn't a file edit.
- **Git** is version control *and* undo. Branch a song, diff an
  arrangement, revert a bad idea.

Think Remotion for music: Remotion is React code that renders to video;
dawai is TypeScript that renders to a track. Vite-style hot reload closes
the loop: edit source → hear the change without stopping playback.

Why code and not a data format or DSL: music *is* structure — repetition,
transposition, variation — and code expresses structure where data
formats can only store the flattened result (`transpose(verse, +3)`;
`repeat(hats, 8)`). Changing a pattern once changes every bar that uses
it: maximal edit-locality and token-efficiency. TypeScript specifically
because agents are better trained on it than on anything we could invent,
and because tsc, LSP, and autocomplete replace an entire hand-built
lint/tooling ecosystem (a lesson paid for in the NoveLLM project's custom
`.vns` DSL). No custom language, ever, unless real agent friction proves
the need.

## The paradigm, mapped

| Codebase concept | dawai equivalent |
|---|---|
| Source files | Song folder (`song.ts`, `parts/*.ts`) |
| Framework / stdlib | `@dawai/composer` — the API songs import |
| Compile | Execute the song source → Document (JSON IR) |
| Typecheck | `dawai check` = tsc + compile + IR validation |
| IR / build artifact | The Document (zod-validated; never hand-edited) |
| Dev server + HMR | Local server: watch → recompile → WebSocket push |
| Browser preview | The dawai UI: timeline, piano roll, transport |
| Compile error overlay | UI keeps playing last-good Document, shows error |
| Editor / IDE | The agent |
| Refactoring tools | Plain code refactoring — it's just TypeScript |
| Version control & undo | Git, plain |

## System components

```
┌─────────────┐   edits source   ┌──────────────────┐
│    Agent     │ ───────────────▶ │   Song folder     │  ← canonical source of truth
│ (any harness)│                  │ song.ts           │
└──────┬───────┘                  │ parts/*.ts        │
       │ dawai CLI                └────────┬──────────┘
       │ (check, transport, status)        │ watch → compile (execute in Bun)
       ▼                                   ▼
┌──────────────────────────────────────────────────────┐
│              Local server (Bun + Hono)               │
│  compile → zod-validate IR → in-memory Document      │
│  WebSocket doc-sync · HTTP: transport, status        │
└────────────────────────┬─────────────────────────────┘
                         │ WebSocket (Document + runtime state)
                         ▼
┌──────────────────────────────────────────────────────┐
│                 UI (React, preview-only)             │
│  visual render: timeline, piano roll, mixer view     │
│  audio render: Tone.js plays the Document            │
│  transport controls + read-only selection            │
└──────────────────────────────────────────────────────┘
```

Data flow is strictly **unidirectional**: source → compile → Document →
UI. The UI never writes anywhere. The only upstream signals from the UI
are runtime state (playhead, transport, user selection), which the agent
can read via `dawai status` but which never touch the files.

## Repository layout (the dawai monorepo)

```
dawai/
├── AGENTS.md            # orientation for agents developing dawai itself
├── docs/
│   ├── architecture.md  # this file — the constitution
│   └── current-state.md # what works today (kept honest as we build)
├── packages/
│   ├── core/            # the Document (IR): zod schemas + pure musical
│   │                    #   utilities. Zero IO, runs anywhere.
│   ├── composer/        # the song-authoring API: sections, patterns,
│   │                    #   combinators, instruments, mixing. Compiles to
│   │                    #   core's Document. This is the product's craft
│   │                    #   center — see docs/composer-design.md.
│   ├── server/          # local server: watch, compile, WS doc-sync,
│   │                    #   transport API, serves the built UI
│   ├── cli/             # `dawai` — init, open, check, play/stop, status
│   └── ui/              # React + Vite + Tailwind + Zustand + Tone.js
└── package.json         # bun workspaces
```

Stack: Bun, Hono, React 19, Vite, Tailwind 4, shadcn/ui (dense preset,
dark-only), TanStack Query, Zustand, Tone.js, Zod, Biome. One happy
path, no swappable providers. UI design direction: mimic Ableton
Live's arrangement view (see goal-2 spec).

## The song project

Created by `dawai init my-song` — a minimal TS project:

```
my-song/
├── AGENTS.md         # generated: composer API guide + CLI usage + workflow
├── package.json      # depends on @dawai/composer
├── tsconfig.json
├── song.ts           # entry: exports the song
└── parts/            # optional: split by section/track as the song grows
```

`song.ts` (illustrative — the composer API is designed in phase 1):

```ts
import { chords, notes } from "@dawai/composer/builders";
import { transpose } from "@dawai/composer/combinators";
import { synth } from "@dawai/composer/instruments";
import { song, track } from "@dawai/composer/song";

const verse = chords(["Am", "F", "C", "G"], { beats: 4 });
const chorus = transpose(verse, 3);

export default song({
  name: "My Song",
  tempo: 120,
  timeSignature: [4, 4],
  tracks: [
    track("keys", synth("warm-pad"), { clips: [verse.at(1), chorus.at(5)] }),
    track("bass", synth("fat-saw"), {
      clips: [notes([[0, 36, 0.5, 100], [0.5, 36, 0.5, 100], [1, 43, 1, 80]]).at(1)],
    }),
  ],
});
```

Composer API principles:

- **Layered.** Raw note tuples (`[start, pitch, length, velocity]`,
  MIDI pitch 0–127) are the always-available floor; structural
  combinators (chords, repeat, transpose, arpeggio, euclid, …) are the
  value layer above it. An agent can always fall back to literal data.
- **Time is musical, in beats** (floats; `0.25` = a 16th at 4/4), never
  seconds. Clip placement is song-absolute; note starts are clip-relative.
- **Deterministic compiles.** Same source → same Document, always.
  Randomness only via seeded generators provided by the composer API.
  Without this, git diffs, hot reload, and "what changed?" all lie.
- Instruments are named presets from a built-in library in v0; params
  become editable later without an IR break (additive fields only).

## The Document (IR)

The compile target: plain JSON — song meta (name, tempo, time signature)
plus tracks → clips → note tuples, zod-defined in `packages/core`, which
is the single authority on its shape. It is a build artifact: never
hand-edited, not committed, regenerated on every compile. The IR schema
is the **stable contract** of the system — server, UI, and future
renderers/analysis depend on it, while the composer API above it evolves
freely. Anything that ever consumes a song programmatically (analysis,
render, a future collaborative layer) consumes the Document, not the
source.

## The CLI

`dawai` is the agent's non-file interface. Every command supports
`--json`, uses stable exit codes, and prints errors that name the fix.
Two modes: if a server is running for this folder, commands route through
it (live UI); `check` also works standalone with no server.

v0 namespaces — deliberately small:

- `dawai init <name>` — scaffold a song project (including its AGENTS.md)
- `dawai open` — start the server for this folder, open the UI
- `dawai check` — tsc + compile + IR validation; the agent's build gate
- `dawai inspect [--track <id>] [--bars a..b] [--mix] [--stats]` — text
  renderings of the compiled Document (arrangement grid, note detail,
  signal flow); the read-back half of the agent's loop
- `dawai play [--from <bar>] [--loop <from> <to>]` / `dawai stop`
- `dawai status` — server/transport state, playhead, and the user's
  current selection in the UI (read-only context: "user selected bars
  9–13 on track 'lead'")

Explicitly **not** in v0: document mutation commands. Editing is editing
source code — transforms that would have been "codemods" in a data-format
design are just functions and refactors in the song's own code.

## Boundaries (the rules that keep this clean)

1. **Source is canonical; the Document is derived.** The Document is a
   compile artifact of the song source, nothing more. Anything that ever
   wants to change the song changes the source and re-enters via the
   watcher.
2. **The UI is a renderer.** It holds no truth and no editing code paths.
   Runtime state (playhead, selection, transport) is ephemeral, lives
   outside the Document, and never touches disk.
3. **Tone.js is quarantined in the UI package.** It is one possible audio
   renderer of the Document. Nothing in core, composer, server, cli, or
   the IR may know it exists — this is what makes a future AudioWorklet
   engine a swap, not a rewrite.
4. **Compiles are pure and deterministic.** No wall-clock, no unseeded
   randomness, no IO in song source. The composer API provides seeded
   generators; the compile sandbox treats nondeterminism as a bug.
5. **Fail fast, degrade gracefully.** A broken compile or invalid IR is a
   hard, precise error from `dawai check` — but the running preview keeps
   playing the last-good Document and shows the error in an overlay.
   Never crash the audio, never silently "fix" bad output.
6. **Hot reload is sacred.** Source change during playback recompiles and
   swaps the Document without stopping the transport (applied at a
   musical boundary). The feedback loop — music keeps playing while the
   agent edits — is the product; protect its latency.

## Designed-for-later (native slots, zero v0 work)

- **Analysis** — `dawai analyze`: pure Document analysis in core (key
  detection, density, clashing notes). Gives the agent "senses" with no
  audio machinery.
- **Auditory feedback** — `dawai render --out mix.wav`: server asks the
  connected UI to render via OfflineAudioContext. Output feeds multimodal
  models or the human's inbox.
- **Constrained generativity** — the NoveLLM lesson ("the composer writes
  the chord changes, the musicians improvise within them"): seeded
  humanization/variation layers in the composer API. The IR never assumes
  every note was hand-placed.
- **UI editing mode** — if ever wanted, it writes through source
  (boundary 1); likely as parameter-level affordances, not note dragging.
- **MCP server** — a thin wrapper over the same CLI/HTTP surface, for
  harnesses that prefer it.
- **Desktop packaging** — Tauri wrap; the app is already local.

## Build phases

1. **core + composer** — the IR schema, then the first composer API
   surface (song/track/notes/chords/repeat/transpose) compiling a demo
   song to a valid Document.
2. **UI shell** — layout (timeline, track lanes, piano roll pane,
   transport bar) rendering the demo Document statically. Look and feel.
3. **Playback** — Tone.js renders the Document; transport works.
4. **The loop** — server + watcher + compile + WebSocket + CLI: agent
   edits `song.ts`, the running preview updates live. First full demo:
   "write a four-bar melancholic chord progression at 90 BPM" → it
   appears and plays.
5. **Full-track depth** — fx chains, buses, automation, ducking, sample
   clips, `inspect --mix/--stats`; driven by the drum & bass validation
   checklist in docs/composer-design.md. Then selection context and
   analysis.
