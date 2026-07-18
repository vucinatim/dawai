#!/usr/bin/env bun
import { Command } from "commander";
import { runCheck } from "./commands/check.ts";
import { runInit } from "./commands/init.ts";
import { runInspect } from "./commands/inspect.ts";
import { runOpen, runStatus, runTransport } from "./commands/live.ts";

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

program
  .command("init")
  .description("Scaffold a new song project (song.ts, tsconfig, AGENTS.md).")
  .argument("<name>", "project directory name")
  .action((name: string) => {
    process.exitCode = runInit(name);
  });

program
  .command("open")
  .description(
    "Start the live server for a song folder (watch + recompile + preview push).",
  )
  .argument("[dir]", "song project directory (default: cwd)")
  .option("--port <port>", "server port (default 4400)")
  .action(async (directory: string | undefined, options: { port?: string }) => {
    process.exitCode = await runOpen(directory, options);
  });

program
  .command("play")
  .description("Start playback in the connected preview.")
  .option("--from <bar>", "1-based bar to play from")
  .option("--port <port>", "server port (default 4400)")
  .action(async (options: { from?: string; port?: string }) => {
    process.exitCode = await runTransport("play", options);
  });

program
  .command("stop")
  .description("Stop playback in the connected preview.")
  .option("--port <port>", "server port (default 4400)")
  .action(async (options: { port?: string }) => {
    process.exitCode = await runTransport("stop", options);
  });

program
  .command("status")
  .description("Live session status: compile state, playhead, user selection.")
  .option("--json", "structured JSON output", false)
  .option("--port <port>", "server port (default 4400)")
  .action(async (options: { json: boolean; port?: string }) => {
    process.exitCode = await runStatus(options);
  });

await program.parseAsync();
