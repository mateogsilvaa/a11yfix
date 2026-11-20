# a11yfix benchmark report

- Mode: `codemod` (codemods only)
- Corpus: `./corpus` (22 pages)
- Engines: a11yfix-core 0.3.0, axe-core 4.14.1, playwright 1.65.1, node 24.15.0
- Run 2026-11-20, total wall time 49.1 s

> a11yfix does not guarantee WCAG conformance. "Verified" means axe-core no longer reports the violation and nothing else broke; it is not a human review.

## Summary

| Metric | Value |
|---|---|
| Pages | 22 |
| Violations detected | 662 |
| Skipped (needs judgment, no model in this run) | 526 |
| Patches proposed | 136 |
| Patches verified | 136 |
| **Fix rate** (verified / detected) | **20.5%** |
| **Precision** (verified / proposed) | **100.0%** |
| False-fix rate (suspicious / (verified + suspicious)) | 0.0% |
| Regression rate (regressions / applied) | 0.0% |
| Mean cost per verified fix | 0 tokens |
| Total tokens | 0 |
| Mean time per page | 2.5 s |
| Subset violations left after applying the output patch | 504 of 662 |
| WCAG A/AA violations (all rules) before → after | 809 → 651 |

## By tier

Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.

| Tier | Proposed | Verified | Precision | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |
|---|---|---|---|---|---|---|---|---|
| 0 (codemod) | 136 | 136 | **100.0%** | 0 | 0 | 0 | 0 | 0 |
| 1 (model) | 0 | 0 | **n/a** | 0 | 0 | 0 | 0 | n/a |

## Outcomes

| Status | Count |
|---|---|
| verified | 136 |
| rejected_suspicious (see below; in the output patch unless --strict) | 0 |
| rejected_persists | 0 |
| rejected_regression | 0 |
| rejected_invalid (bad patch shape) | 0 |
| rejected_invalid (no usable model output) | 0 |
| rejected_apply_failed | 0 |
| skipped | 526 |

## By rule

| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision | False-fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| image-alt | 1.0.0 | 1 | 159 | 159 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| label | 1.0.0 | 0 | 55 | 50 | 5 | 5 | 9.1% | 100.0% | 0.0% | 0.0% |
| heading-order | 1.0.0 | 0 | 7 | 3 | 4 | 4 | 57.1% | 100.0% | 0.0% | 0.0% |
| aria-allowed-attr | 1.0.0 | 0 | 151 | 29 | 122 | 122 | 80.8% | 100.0% | 0.0% | 0.0% |
| aria-required-attr | 1.0.0 | 1 | 34 | 34 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| aria-valid-attr-value | 1.0.0 | 0 | 58 | 55 | 3 | 3 | 5.2% | 100.0% | 0.0% | 0.0% |
| aria-roles | 1.0.0 | 0 | 17 | 15 | 2 | 2 | 11.8% | 100.0% | 0.0% | 0.0% |
| color-contrast | 1.0.0 | 1 | 181 | 181 | 0 | 0 | 0.0% | n/a | n/a | n/a |

## By page

| Page | Detected | Verified | Left after patch | WCAG A/AA before → after | Time |
|---|---|---|---|---|---|
| external/axe-core/aria-allowed-attr.html | 23 | 8 | 13 | 33 → 23 | 1.6 s |
| external/axe-core/aria-required-attr.html | 16 | 0 | 16 | 24 → 24 | 0.5 s |
| external/axe-core/aria-roles.html | 22 | 0 | 22 | 60 → 60 | 0.6 s |
| external/axe-core/aria-valid-attr-value.html | 189 | 113 | 55 | 198 → 64 | 36.0 s |
| external/axe-core/color-contrast.html | 22 | 0 | 22 | 28 → 28 | 1.1 s |
| external/axe-core/heading-order.html | 3 | 0 | 3 | 3 → 3 | 0.4 s |
| external/axe-core/image-alt.html | 19 | 0 | 19 | 22 → 22 | 0.4 s |
| external/axe-core/label.html | 14 | 0 | 14 | 28 → 28 | 0.7 s |
| external/w3c-bad/home.html | 71 | 0 | 71 | 84 → 84 | 1.0 s |
| external/w3c-bad/news.html | 75 | 0 | 75 | 86 → 86 | 1.0 s |
| external/w3c-bad/survey.html | 71 | 0 | 71 | 83 → 83 | 1.3 s |
| external/w3c-bad/tickets.html | 70 | 0 | 70 | 81 → 81 | 1.2 s |
| handwritten/01-bakery-images.html | 7 | 0 | 7 | 10 → 10 | 0.5 s |
| handwritten/02-newsletter-labels.html | 4 | 3 | 1 | 5 → 2 | 1.4 s |
| handwritten/03-docs-headings.html | 2 | 1 | 1 | 4 → 3 | 1.0 s |
| handwritten/04-dashboard-roles.html | 7 | 2 | 5 | 7 → 5 | 1.5 s |
| handwritten/05-settings-aria-values.html | 7 | 4 | 3 | 9 → 5 | 1.5 s |
| handwritten/06-pricing-contrast.html | 7 | 0 | 7 | 7 → 7 | 0.6 s |
| handwritten/07-recipe-mixed.html | 7 | 1 | 6 | 8 → 7 | 1.0 s |
| handwritten/08-portfolio-ambiguous.html | 10 | 0 | 10 | 12 → 12 | 0.5 s |
| handwritten/09-event-signup.html | 7 | 4 | 4 | 8 → 5 | 1.4 s |
| handwritten/10-coworking-crlf.html | 9 | 0 | 9 | 9 → 9 | 0.6 s |

## Skipped

| Rule and reason | Count |
|---|---|
| color-contrast: needs judgment (tier-1 rule without codemod); no model configured | 181 |
| image-alt: needs judgment (tier-1 rule without codemod); no model configured | 159 |
| aria-valid-attr-value: codemod declined; no model configured | 55 |
| label: codemod declined; no model configured | 50 |
| aria-required-attr: needs judgment (tier-1 rule without codemod); no model configured | 34 |
| aria-allowed-attr: codemod declined; no model configured | 29 |
| aria-roles: codemod declined; no model configured | 15 |
| heading-order: codemod declined: its edit fails shape validation (diff has 3 hunks (max 2)); no model configured | 2 |
| heading-order: codemod declined; no model configured | 1 |

## Verifier checks

Every applied patch is compared with the original page: axe-core with the full WCAG 2.x A/AA rule set, static suspicion checks on the patched source, and:

- accessibility tree (computed role, name, states, focusability of every element): on
- focus order (Tab sequence): on
- visual (full-page screenshots): desktop 1280x900; limit 0.10% of pixels changed outside the patched elements; layout shifts measured, not enforced

| | Patches |
|---|---:|
| Compared beyond axe | 136 |
| Rejected by the accessibility-tree comparison | 0 |
| Rejected by the focus-order comparison | 0 |
| Rejected by the visual comparison | 0 |
| Moved other elements on the page (layout shift, reported only) | 4 |

Largest pixel change outside the patched elements on a page without layout shift: 0.000%.

## Definitions

- **Detected**: violations of the patched rule subset reported by axe-core, one per node.
- **Skipped**: no patch attempted: the rule's deterministic codemod declined (the fix needs judgment) and no model was configured.
- **Proposed**: a well-formed patch was produced, by a tier-0 codemod or by the tier-1 model (valid JSON matching the schema, within 3 attempts).
- **Applied**: the patch passed shape validation (exact `before` substring, ≤ 6 lines, ≤ 2 hunks) and the patched page was re-audited.
- **Verified**: after applying the patch to a copy, the original violation is gone from the target node, no new WCAG 2.x A/AA violation appeared anywhere on the page, and no suspicion check fired (static checks, plus the accessibility-tree, focus-order and visual comparisons when they ran).
- **False-fix rate**: of the patches that made axe happy, the share flagged as suspicious.
- **Regression rate**: of the applied patches, the share that introduced a new violation.
- Token costs count input, output, and prompt-cache reads and writes. Dollar figures are estimates from list prices.

## Analysis

This run is **tier 0 only**: deterministic codemods, no model, no network. It is the floor a11yfix gives on a
machine with nothing configured, and the part of the system that must never be wrong.

**Precision: every tier-0 patch verified.** No suspicious patches, no regressions, no patches that left the
violation in place. Getting there took two fixes to `heading-order` found by this benchmark: re-levelling a heading
without moving its siblings left a sibling skipping a level (a new violation the verifier caught), and dragging a
sub-heading that already skipped a level along with its parent kept that violation inside the edited span (reported
as "persists"). The current codemod moves siblings with the target, re-levels only headings the change would break,
leaves pre-existing problems to their own findings, and declines when keeping the outline intact would take more
than a small patch.

**Coverage is low on purpose.** The fix rate is about a fifth of what was detected. Most of the rest is tier 1 by
design: `image-alt`, `color-contrast` and `aria-required-attr` need judgment about meaning, design or widget state,
and tier 0 does not touch them. The other skips are codemods declining:

- `aria-allowed-attr` fixes most of its findings by removing attributes that assistive technology ignores anyway.
  It declines state attributes (`aria-checked` on a `<button>`, `aria-selected` on a link): those usually mean the
  role is wrong, and deleting them throws the author's intent away.
- `label` fixes only the unambiguous layouts (text and control alone in a parent, a two-cell table row). The W3C
  pages and the axe-core fixture mostly have controls with no visible text nearby, or several controls under one
  label: tier 1.
- `heading-order` declines the axe-core fixture because it uses `role="heading"` custom elements (the source outline
  would not match what assistive technology sees), and declines the CRLF page because its three sibling `h3`s
  would need three edits.
- `aria-valid-attr-value` and `aria-roles` decline most of the axe-core fixtures, which are adversarial on purpose:
  abstract roles, tokens like `aria-live="loud"`, and id references with no near match. The hand-written pages,
  closer to real mistakes (`role="buton"`, `aria-expanded="yes"`), are fixed.

**What 100% means here.** Precision is measured against the verifier: axe-clean, no new WCAG A/AA violation, no
suspicion check. Two tier-0 decisions are worth naming because the verifier cannot judge them. `aria-pressed="0"`
becomes `"false"`, which takes the author at their word even on a "Delete account" button that was probably never
meant to be a toggle. And removing a disallowed `aria-level` from a `<div>` keeps what users get today but does not
recover what the author meant (probably a heading). Phase 3 (accessibility-tree diff) will make the first kind of
change visible to the verifier.

**Where the lesson came from.** The prototype had a naive "heuristic" generator instead of codemods. Its
file-name alt text (`q3-sales.png` → `alt="Q3 sales"`) passed axe 88% of the time on this corpus, until the verifier
learned to reject alt text that only restates the file name. That is why tier 0 does not touch `image-alt` at all,
and why the sabotage test includes file-name alt text.
