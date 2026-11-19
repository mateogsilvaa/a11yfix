# 0001. Every patch is verified by re-auditing a patched copy

## Context
Auditors stop at detection. A tool that also writes fixes is only useful if its fixes can be trusted, and neither a
language model nor a rule engine can be trusted by default.

## Decision
No patch is reported as fixed until it has been applied to a copy of the page, the copy has been re-audited, the
original violation is gone from the target node, no new violation appeared, and no suspicion check fired. The
verifier is the same for every tier and every rule. If something has to be cut, cut features, never the verifier.

## Consequences
Every patch costs a browser audit (about 0.2-0.5 s). "Verified" is defined narrowly (axe-clean and nothing else
broke) and the docs say so. Weakening the verifier is a governance-level change (GOVERNANCE.md), and the sabotage
test (`packages/core/test/sabotage.test.ts`) guards against it happening silently.
