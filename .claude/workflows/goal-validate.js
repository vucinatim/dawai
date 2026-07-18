export const meta = {
  name: "goal-validate",
  description: "Adversarial multi-lens validation of a completed dawai goal",
  whenToUse:
    "At the end of each goal in docs/goals/, before declaring it complete",
  phases: [
    { title: "Review", detail: "four independent lenses over the goal scope" },
    { title: "Verify", detail: "adversarial refutation of every finding" },
  ],
};

const parsedArguments = typeof args === "string" ? JSON.parse(args) : args;
const goalSpec = parsedArguments?.goal;
if (!goalSpec)
  throw new Error('Pass { goal: "docs/goals/goal-N-*.md" } as args');

const FINDINGS_SCHEMA = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "summary", "evidence", "severity"],
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          summary: { type: "string" },
          evidence: {
            type: "string",
            description: "concrete code/output proving the issue",
          },
          severity: { enum: ["blocker", "should-fix", "nit"] },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["refuted", "reasoning"],
  properties: {
    refuted: { type: "boolean" },
    reasoning: { type: "string" },
  },
};

const COMMON = `You are validating a completed goal in the dawai repo
(/Users/timvucina/Desktop/MyProjects/dawai). Read the goal spec at
${goalSpec}, then docs/architecture.md and docs/composer-design.md.
Investigate the actual code and run real commands (bun test, typecheck,
the CLI) — never trust claims in docs or comments over observed
behavior. Report only defects you can evidence concretely; no
style-preference noise.`;

const LENSES = [
  {
    key: "boundaries",
    prompt: `${COMMON}
LENS: architecture boundary compliance. For every numbered boundary in
docs/architecture.md that applies to this goal's packages, hunt for
violations: UI code paths that mutate the Document, Tone.js (or any
audio) imports outside packages/ui, nondeterminism in compile paths
(Date.now, Math.random, unseeded generators, IO), Document truth held
anywhere but its canonical home, editing surfaces that bypass source
files. Also flag boundaries enforced only by convention where a test or
lint rule was feasible.`,
  },
  {
    key: "contract",
    prompt: `${COMMON}
LENS: acceptance-criteria honesty. Take the goal spec's acceptance
checklist literally and verify each item is genuinely met, not
approximately: run the test suite and read the tests (do snapshot tests
actually assert determinism? do error-path tests assert messages, not
just throws?), run the CLI commands and inspect their real output,
check exit codes and --json shapes. Flag any criterion that is
unchecked, weakly checked, or checked by a test that would pass even if
the feature were broken.`,
  },
  {
    key: "api-taste",
    prompt: `${COMMON}
LENS: composer API fidelity and ergonomics. Compare the implemented
authoring surface against docs/composer-design.md: missing or renamed
primitives, signatures that drifted from the doc, doc examples that no
longer compile as written. Then judge ergonomics as an agent-author
would: write (mentally compile) a short original song against the real
API and flag anything verbose, surprising, or trap-laden — wrong
defaults, unit confusion (beats vs bars vs dB), combinators that don't
compose. Fidelity findings need code evidence; ergonomic findings need
a concrete better alternative.`,
  },
  {
    key: "quality",
    prompt: `${COMMON}
LENS: exemplary-codebase bar. This repo intends to be a reference-grade
codebase. Hunt for: shallow modules (wrappers that just forward),
duplicated logic with two sources of truth, dead code, swallowed
errors or fallback values that hide bugs, abstractions with a single
caller that earn nothing, cross-package imports that violate the
dependency direction (core ← composer ← cli/server/ui), and misleading
names. Ignore formatting and comment style; Biome owns those.`,
  },
];

const results = await pipeline(
  LENSES,
  (lens) =>
    agent(lens.prompt, {
      label: `review:${lens.key}`,
      phase: "Review",
      schema: FINDINGS_SCHEMA,
    }),
  (review, lens) =>
    parallel(
      (review?.findings ?? []).map(
        (f) => () =>
          agent(
            `${COMMON}
Adversarially verify this ${lens.key} finding — your job is to REFUTE it.
Reproduce the evidence yourself; if you cannot reproduce it, or the code
handles it correctly, or the goal spec explicitly scopes it out, it is
refuted. Finding: ${JSON.stringify(f)}`,
            {
              label: `verify:${f.file}`,
              phase: "Verify",
              schema: VERDICT_SCHEMA,
            },
          ).then((v) => ({ ...f, lens: lens.key, verdict: v })),
      ),
    ),
);

const confirmed = results
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict && !f.verdict.refuted)
  .sort(
    (a, b) =>
      ["blocker", "should-fix", "nit"].indexOf(a.severity) -
      ["blocker", "should-fix", "nit"].indexOf(b.severity),
  );

log(
  `${confirmed.length} confirmed findings (of ${results.flat().filter(Boolean).length} raw)`,
);
return { goal: goalSpec, confirmed }
