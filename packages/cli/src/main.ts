#!/usr/bin/env bun
import { Command } from "commander";
import { runCheck } from "./commands/check.ts";
import { runInspect } from "./commands/inspect.ts";

/**
 * dawai — the agent's non-file interface to a song project.
 * Exit codes: 0 = success, 1 = any failure. Every command supports
 * --json for structured output.
 */

const program = new Command();

program
  .name("dawai")
  .description(
    "dawai CLI — check and inspect a song project (a folder whose song.ts default-exports song({...})).",
  );

program
  .command("check")
  .description("The build gate: typecheck + compile + Document validation.")
  .argument("[dir]", "song project directory (default: cwd)")
  .option("--json", "structured JSON output", false)
  .option(
    "--skip-typecheck",
    "skip tsc (compile + validate only; faster)",
    false,
  )
  .action(
    async (
      directory: string | undefined,
      options: { json: boolean; skipTypecheck: boolean },
    ) => {
      process.exitCode = await runCheck(directory, {
        json: options.json,
        typecheck: !options.skipTypecheck,
      });
    },
  );

program
  .command("inspect")
  .description(
    "Text renderings of the compiled Document (default: arrangement grid).",
  )
  .argument("[dir]", "song project directory (default: cwd)")
  .option("--track <id>", "note-level detail for one track")
  .option(
    "--bars <a..b>",
    'limit --track to a 1-based bar range, e.g. "17..25"',
  )
  .option("--mix", "signal flow: chains, gains, routes, automation", false)
  .option(
    "--stats",
    "aggregate stats: lengths, ranges, per-section density, warnings",
    false,
  )
  .option("--json", "print the full Document as JSON", false)
  .action(
    async (
      directory: string | undefined,
      options: {
        track?: string;
        bars?: string;
        mix: boolean;
        stats: boolean;
        json: boolean;
      },
    ) => {
      process.exitCode = await runInspect(directory, options);
    },
  );

await program.parseAsync();
