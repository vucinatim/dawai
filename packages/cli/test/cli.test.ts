import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

/**
 * End-to-end CLI tests: spawn the real binary against the fixtures and
 * assert output, structure, and exit codes — the same surface an agent
 * uses. Most tests skip tsc for speed; one full check covers it.
 */

const repoRoot = resolve(import.meta.dir, "../../..");
const cliEntry = resolve(repoRoot, "packages/cli/src/main.ts");
const demoSong = resolve(repoRoot, "fixtures/dnb-demo");
const invalidSong = resolve(repoRoot, "fixtures/invalid-song");
const minimalSong = resolve(repoRoot, "fixtures/minimal-song");
const nondeterministicSong = resolve(
  repoRoot,
  "fixtures/nondeterministic-song",
);

function dawai(...cliArguments: string[]): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = Bun.spawnSync(["bun", cliEntry, ...cliArguments], {
    cwd: repoRoot,
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("dawai check", () => {
  test("passes the demo song with a summary (skip-typecheck)", () => {
    const result = dawai("check", demoSong, "--skip-typecheck");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ Neon Rain");
    expect(result.stdout).toContain("6 tracks, 136 bars at 174 BPM");
  });

  test("emits structured JSON with a summary", () => {
    const result = dawai("check", demoSong, "--skip-typecheck", "--json");
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.errors).toEqual([]);
    expect(payload.summary).toEqual({
      name: "Neon Rain",
      tempo: 174,
      tracks: 6,
      bars: 136,
    });
  });

  test("full check including tsc passes on the demo song", () => {
    const result = dawai("check", demoSong);
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  }, 60000);

  test("fails the invalid song with the precise routing error and exit 1", () => {
    const result = dawai("check", invalidSong, "--skip-typecheck");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[compile]");
    expect(result.stderr).toContain('Route "drumbus" does not exist');
    expect(result.stderr).toContain("Available outputs: master");
  });

  test("reports structured errors as JSON with exit 1", () => {
    const result = dawai("check", invalidSong, "--skip-typecheck", "--json");
    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(false);
    expect(payload.errors[0].stage).toBe("compile");
    expect(payload.errors[0].message).toContain(
      'Route "drumbus" does not exist',
    );
  });

  test("names the expectation when song.ts is missing", () => {
    const result = dawai("check", repoRoot, "--skip-typecheck");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No song.ts in");
  });

  test("determinism guard: a song calling Math.random() fails check with the boundary diagnostic", () => {
    const result = dawai("check", nondeterministicSong, "--skip-typecheck");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Math.random()");
    expect(result.stderr).toContain("compiles must be deterministic");
    expect(result.stderr).toContain("humanize");
  });

  test("passes the minimal empty-timeline song", () => {
    const result = dawai("check", minimalSong, "--skip-typecheck");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Blank Slate");
  });
});

describe("cross-execution determinism", () => {
  test("two fresh CLI runs produce byte-identical Documents", () => {
    const first = dawai("inspect", demoSong, "--json");
    const second = dawai("inspect", demoSong, "--json");
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});

describe("dawai inspect", () => {
  test("renders the arrangement grid by default", () => {
    const result = dawai("inspect", demoSong);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("|intro");
    expect(result.stdout).toContain("|drop");
    expect(result.stdout).toMatch(/drums\s+\./);
  });

  test("renders track detail with note names in a bar window", () => {
    const result = dawai(
      "inspect",
      demoSong,
      "--track",
      "sub",
      "--bars",
      "33..34",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("track sub");
    expect(result.stdout).toContain("E1");
  });

  test("rejects unknown tracks and lists the real ones", () => {
    const result = dawai("inspect", demoSong, "--track", "bass");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Track "bass" does not exist');
    expect(result.stderr).toContain("drums");
  });

  test("renders the mix view with routes and duck lanes", () => {
    const result = dawai("inspect", demoSong, "--mix");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("→ drumbus");
    expect(result.stdout).toContain("compressor");
    expect(result.stdout).toContain("track sub.duck");
  });

  test("renders stats with song length and warnings section", () => {
    const result = dawai("inspect", demoSong, "--stats");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("174 BPM");
    expect(result.stdout).toContain("136 bars");
  });

  test("--json prints the full Document", () => {
    const result = dawai("inspect", demoSong, "--json");
    expect(result.exitCode).toBe(0);
    const document = JSON.parse(result.stdout);
    expect(document.version).toBe(1);
    expect(document.tracks).toHaveLength(6);
  });

  test("fails with compile errors when the song is broken", () => {
    const result = dawai("inspect", invalidSong);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not compile");
  });

  test("--json emits a structured error payload when the song is broken", () => {
    const result = dawai("inspect", invalidSong, "--json");
    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(false);
    expect(payload.errors[0].message).toContain(
      'Route "drumbus" does not exist',
    );
  });

  test("renders the empty-timeline placeholder for the minimal song", () => {
    const result = dawai("inspect", minimalSong);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("empty song");
  });
});
