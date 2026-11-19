# 0004. Check regressions against every WCAG 2.x A/AA rule

## Context
Only a handful of rules are patched, but a patch can break rules it is not about: `alt=""` on a linked image
silences `image-alt` and leaves the link nameless; deleting an invalid `aria-checked` triggers `aria-required-attr`.

## Decision
The re-audit runs the patched rules plus every non-experimental axe rule tagged WCAG 2.0/2.1/2.2 A or AA. Any new
violation anywhere on the page rejects the patch. Node identity across the edit uses (rule, source offset), with
offsets shifted past the edit and anything inside the edited span keyed to the span.

## Consequences
Stricter than "the rule went away"; some correct fixes are rejected for real side effects (for example `target-size`
when a new button sits next to an input). Those are reported as regressions, not hidden. A configurable regression
threshold is on the roadmap (phase 3).
