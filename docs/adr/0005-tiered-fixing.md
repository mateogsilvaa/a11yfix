# 0005. Deterministic codemods first; the model only for judgment

## Context
Many violations have exactly one correct fix that can be computed from the markup (a misspelled role, a boolean
written as "yes", a label sitting next to its input). Sending them to a model costs money, adds variance, and can
only lose precision.

## Decision
Tier 0: each rule may ship a deterministic codemod that fixes the cases it can prove and declines the rest. Tier 1:
the model handles what tier 0 declines, and rules that are inherently about judgment (`image-alt`,
`color-contrast`, missing widget state). Tiers are reported separately, and tier 0 is held to 100% precision on the
corpus.

## Consequences
`--mode codemod` runs with no model and no network. Codemods decline aggressively; coverage grows by adding provably
safe sub-cases, never by guessing. This replaces the prototype's "naive heuristic" baseline, whose main lesson
(file-name alt text passes axe) survives as a suspicion check and as part of the sabotage test.
