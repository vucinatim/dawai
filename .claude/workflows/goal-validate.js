export const meta = {
  name: "goal-validate",
  description: "Lean adversarial validation of a completed dawai goal (budget-conscious)",
  whenToUse:
    "Optional heavy check at the end of a goal — the default validation is gates + main-loop self-review; run this only when explicitly requested.",
  phases: [
    { title: "Review", detail: "one reviewer, all lenses" },
    { title: "Verify", detail: "one refuter per blocker (capped)" },
  ],
};

const parsedArguments = typeof args === "string" ? JSON.parse(args) : args;
const goalSpec = parsedArguments?.goal;
if (!goalSpec) throw new Error('Pass { goal: "docs/goals/goal-N-*.md" } as args');

const FINDINGS_SCHEMA = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        required: ["file", "summary", "evidence", "severity"],
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          summary: { type: "string" },
          evidence: { type: "string" },
          severity: { enum: ["blocker", "should-fix", "nit"] },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["refuted", "reasoning"],
  properties: { refuted: { type: "boolean" }, reasoning: { type: "string" } },
};

const review = await agent(
  `You are validating a completed goal in the dawai repo
(/Users/timvucina/Desktop/MyProjects/dawai). Read the goal spec at
${goalSpec}, docs/architecture.md, and docs/composer-design.md, then
investigate the code and run real commands (bun test, typecheck, the
CLI). Review through ALL of these lenses at once, but report ONLY
high-confidence, evidenced defects — at most 10, ranked by severity:
(1) architecture boundary violations enforced by neither code nor test;
(2) acceptance-criteria items that are unmet or covered by tests that
would pass even if broken; (3) implementation drift from the design
docs; (4) real correctness bugs. Skip style, taste, and speculation.
Every finding needs concrete evidence you produced yourself.`,
  { label: "review:all-lenses", phase: "Review", schema: FINDINGS_SCHEMA },
);

const blockers = (review?.findings ?? []).filter((f) => f.severity === "blocker").slice(0, 3);
const verified = await parallel(
  blockers.map((finding) => () =>
    agent(
      `In the dawai repo (/Users/timvucina/Desktop/MyProjects/dawai), try to
REFUTE this finding by reproducing its evidence yourself. Read-only
investigation plus running tests/CLI; do not modify tracked files.
If you cannot reproduce it, it is refuted. Finding: ${JSON.stringify(finding)}`,
      { label: `verify:${finding.file}`, phase: "Verify", schema: VERDICT_SCHEMA, effort: "low" },
    ).then((verdict) => ({ ...finding, verdict })),
  ),
);

const confirmedBlockers = verified.filter(Boolean).filter((f) => f.verdict && !f.verdict.refuted);
const rest = (review?.findings ?? []).filter((f) => f.severity !== "blocker");
log(`${confirmedBlockers.length} confirmed blockers, ${rest.length} unverified lesser findings`);
return { goal: goalSpec, confirmedBlockers, unverified: rest };
