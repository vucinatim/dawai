import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Architecture boundaries enforced by test, not convention:
 * - Boundary 3: no audio library (Tone.js) anywhere outside packages/ui.
 * - Boundary 4: @dawai/core and @dawai/composer are pure — no IO, no
 *   runtime APIs (node:*, Bun), no audio, no wall-clock/randomness.
 */

const repoRoot = resolve(import.meta.dir, "../../..");
const PURE_PACKAGES = ["packages/core/src", "packages/composer/src"];
const FORBIDDEN_IMPORT = /from\s+["'](node:|bun|tone)/;
const FORBIDDEN_GLOBALS =
  /\b(Bun\.|process\.|require\(|Math\.random\(|Date\.now\(|new Date\()/;

// The determinism guard is the one sanctioned exception: it exists to
// poison these globals, so it necessarily names them.
const EXEMPT_FILES = new Set(["determinism.ts"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return entry.endsWith(".ts") && !EXEMPT_FILES.has(entry) ? [path] : [];
  });
}

describe("purity boundaries (architecture 3 + 4)", () => {
  for (const packagePath of PURE_PACKAGES) {
    test(`${packagePath} imports no IO, runtime, or audio modules`, () => {
      for (const file of sourceFiles(resolve(repoRoot, packagePath))) {
        const source = readFileSync(file, "utf8");
        const importViolation = source.match(FORBIDDEN_IMPORT);
        expect(
          importViolation,
          `${file} imports a forbidden module: ${importViolation?.[0] ?? ""}`,
        ).toBeNull();
        const globalViolation = source.match(FORBIDDEN_GLOBALS);
        expect(
          globalViolation,
          `${file} uses a forbidden global: ${globalViolation?.[0] ?? ""}`,
        ).toBeNull();
      }
    });
  }

  test("pure packages depend only on zod and each other", () => {
    for (const packageName of ["core", "composer"]) {
      const manifest = JSON.parse(
        readFileSync(
          resolve(repoRoot, `packages/${packageName}/package.json`),
          "utf8",
        ),
      ) as { dependencies?: Record<string, string> };
      const allowed = new Set(["zod", "@dawai/core"]);
      for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        expect(
          allowed.has(dependency),
          `packages/${packageName} depends on ${dependency}`,
        ).toBe(true);
      }
    }
  });
});
