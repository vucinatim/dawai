# dawai — agent orientation

dawai is a local-first, agent-driven DAW. The song is a small TypeScript
project that compiles (executes) to a zod-validated JSON IR — the
Document — which the app renders, preview-only, with playback controls.
The agent is the editor.

**Read [docs/architecture.md](docs/architecture.md) before changing
anything structural.** It is the constitution: paradigm, boundaries,
file format, CLI surface, build phases.

## Working here

- Monorepo: bun workspaces under `packages/` (core, composer, server, cli, ui).
- Stack: Bun, Hono, React 19, Vite, Tailwind 4, shadcn/ui (dense preset,
  dark-only, Ableton-style UI), Zustand, Tone.js, Zod, Biome.
- Non-negotiable boundaries (details in architecture.md):
  - Song source is canonical; the Document (IR) is a derived compile artifact.
  - Data flow is unidirectional: source → compile → Document → UI. The UI never edits.
  - Compiles are pure and deterministic (seeded randomness only).
  - Tone.js exists only inside `packages/ui`.
  - UI state lives in Zustand stores with reducer-style actions and
    narrow selectors — no prop drilling, ever.
- `docs/current-state.md` tracks what actually works; update it when a
  phase lands.

## Status

Pre-code. Architecture settled; phase 1 (core schemas) is next.
