# 0014. A naive baseline and a per-layer view of the verifier

## Context
The benchmark measured precision against the verifier and nothing else. That number cannot show what the verifier
contributes (a pipeline without it would report every applied patch as fixed), and it cannot show the verifier's own
blind spots: a generator can only look as good as the verifier lets it. With no model available offline, tier 1 had
no numbers at all, and tier 0 is at 100% by design, so neither run said anything about the verifier itself.

## Decision
- `Verification` records `flaggedBy`: which layers raised a suspicion reason (`static`, `rule`,
  `accessibility-tree`, `focus-order`, `visual`), even when the patch was rejected for another reason first. It is
  an optional field; existing consumers are unaffected.
- Every benchmark report has a "What the verifier adds" table: the same applied patches judged with no verifier
  (shape validation only), axe only, axe plus source checks, and the full verifier, with how many each weaker
  verifier would have shipped that the full one rejects. The full verifier is the reference, and the report says it
  is not ground truth.
- Rates in the tier and rule tables carry a 95% Wilson interval and n.
- `bench/baselines/naive-fixer.mjs` is a deliberately naive generator (common unchecked quick fixes) run through the
  ordinary `--generator-cmd` protocol, offline. Its results, artifacts and analysis are published under
  `bench/baselines/naive/`, including the patches it gets verified that a reviewer would reject.

## Consequences
- The verifier's value is measured: 194 of 653 naive patches rejected, 167 of which axe alone would have accepted.
- Its limits are measured too: 459 naive patches verified, many of them wrong in ways no automatic check sees
  (invented state, invisible names, inline color overrides). Precision against the verifier is published as an upper
  bound, and the README says so next to the number.
- The baseline is a strawman. It must never be presented as a comparison with other tools, and it must not be tuned
  to make the verifier look better: it changes only to fix bugs in the baseline itself.
