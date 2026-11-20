// Benchmark statistics: the Wilson interval and the verifier ablation counts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { metricsOf, rateCI, wilson, type PatchOutcome, type Verification } from "a11yfix-core";

describe("wilson", () => {
  it("matches known 95% intervals", () => {
    const [lo, hi] = wilson(136, 136);
    assert.ok(Math.abs(lo - 0.9725) < 0.001, `lo ${lo}`);
    assert.equal(hi, 1);
    const [lo2, hi2] = wilson(11, 20);
    assert.ok(Math.abs(lo2 - 0.3421) < 0.001 && Math.abs(hi2 - 0.7418) < 0.001, `${lo2} ${hi2}`);
  });
  it("is uninformative with no samples", () => {
    assert.deepEqual(wilson(0, 0), [0, 1]);
    assert.equal(rateCI(0, 0), "n/a");
  });
  it("prints the sample size with the rate", () => {
    assert.equal(rateCI(136, 136), "100.0% [97.3–100], n=136");
  });
});

describe("verifier ablation counts", () => {
  const outcome = (status: Verification["status"], flaggedBy?: Verification["flaggedBy"]) =>
    ({
      finding: { ruleId: "image-alt" },
      generation: { patch: { findingId: "f" }, tier: 1, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } },
      verification: { status, flaggedBy },
    }) as unknown as PatchOutcome;

  it("separates what axe, the source checks and the browser checks reject", () => {
    const m = metricsOf([
      outcome("verified"),
      outcome("rejected_suspicious", ["static"]),
      outcome("rejected_suspicious", ["static", "accessibility-tree"]),
      outcome("rejected_suspicious", ["visual"]),
      outcome("rejected_suspicious", ["rule"]),
      outcome("rejected_regression", ["static"]),
      outcome("rejected_persists"),
    ]);
    assert.equal(m.applied, 7);
    assert.equal(m.axeAccepted, 5); // verified + every suspicious one
    assert.equal(m.sourceAccepted, 2); // verified + the one only the browser checks caught
    assert.equal(m.verified, 1);
  });
});
