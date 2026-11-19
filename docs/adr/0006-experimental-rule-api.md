# 0006. The Rule API stays experimental until the verifier is hardened

## Context
Third-party rules are how the project would grow. But a rule ecosystem on top of a verifier that only knows what
axe reports invites rules that make axe quiet without making pages better.

## Decision
The typed `Rule` interface (`detect`, `fix`, `verify`, `wcag`, `tier`, `confidence`, versioning, deprecation) is the
contract `a11yfix-rules-core` is written against, but it stays **experimental** (breaking changes allowed in minor
versions) and closed to external packages until the verifier diffs the accessibility tree and checks visual
regressions (roadmap phase 3). Rules can only add verification checks, never remove core ones.

## Consequences
Community rule packages (`a11yfix-rules-community`), `a11yfix-rules-wcag22` and the public registry wait for phase 3.
In the meantime the API is exercised by the core rules and documented in the rule author guide.
