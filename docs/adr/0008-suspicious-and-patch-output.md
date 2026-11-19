# 0008. Suspicious patches: report section and `--strict`; output a git patch

## Context
Suspicious patches (they pass axe but trip a check such as generic alt text or added `aria-hidden`) were treated as
a manual-review queue. Nobody works through queues; people review diffs in pull requests.

## Decision
`rejected_suspicious` is its own section of every report, with the reason for each patch. By default suspicious
patches are included in the output patch so the reviewer sees them in context; `--strict` leaves them out. The
output of `fix --verify` is a standard unified diff with git headers (`a11yfix.patch`), applicable with
`git apply` from the repository root.

## Consequences
Users decide strictness per run (CI should use `--strict`). Metrics are unaffected: suspicious patches never count
as verified.
