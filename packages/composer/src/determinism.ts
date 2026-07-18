import { CompileError } from "./compile.ts";

/**
 * The unseeded-randomness guard (architecture boundary 4): while song
 * source executes and compiles, the ambient nondeterminism sources are
 * poisoned so any use fails fast with a compiler diagnostic instead of
 * silently producing a different Document per run.
 */

interface PoisonTarget {
  holder: Record<string, unknown>;
  key: string;
  label: string;
}

const POISON_TARGETS: PoisonTarget[] = [
  {
    holder: Math as unknown as Record<string, unknown>,
    key: "random",
    label: "Math.random()",
  },
  {
    holder: Date as unknown as Record<string, unknown>,
    key: "now",
    label: "Date.now()",
  },
  {
    holder: performance as unknown as Record<string, unknown>,
    key: "now",
    label: "performance.now()",
  },
];

export async function withDeterminismGuard<T>(
  run: () => Promise<T> | T,
): Promise<T> {
  const originals = POISON_TARGETS.map(({ holder, key }) => holder[key]);
  for (const { holder, key, label } of POISON_TARGETS) {
    holder[key] = () => {
      throw new CompileError(
        `Song source called ${label} — compiles must be deterministic (same source, same track; architecture boundary 4). Use the seeded helpers instead: humanize(pattern, { seed }), vary(pattern, { seed }).`,
      );
    };
  }
  try {
    return await run();
  } finally {
    POISON_TARGETS.forEach(({ holder, key }, index) => {
      holder[key] = originals[index];
    });
  }
}
