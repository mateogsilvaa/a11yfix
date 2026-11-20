# a11yfix benchmark report

- Mode: `codemod` (codemods only)
- Corpus: `./corpus` (95 pages: 73 eval, held out; 22 dev, used for tuning)
- Engines: a11yfix-core 0.3.0, axe-core 4.14.1, playwright 1.65.1, node 26.13.1
- Run 2026-11-20, total wall time 100.0 s

> a11yfix does not guarantee WCAG conformance. "Verified" means axe-core no longer reports the violation and nothing else broke; it is not a human review.

## Dev and eval

Dev pages were read and debugged while the codemods and prompts were written, so their numbers are optimistic. Eval pages (under `eval/`) were never used for tuning: quote those. Each set is reported in full below.

| Metric | Eval (held out) | Dev (used for tuning) |
|---|---|---|
| Pages | 73 | 22 |
| Violations detected | 738 | 662 |
| Patches verified | 18 | 136 |
| **Fix rate** (verified / detected) | 2.4% [1.5–3.8], n=738 | 20.5% [17.6–23.8], n=662 |
| **Precision** (verified / proposed) | 100.0% [82.4–100], n=18 | 100.0% [97.3–100], n=136 |
| Tier 0 precision | 100.0% [82.4–100], n=18 | 100.0% [97.3–100], n=136 |
| Tier 1 precision | n/a | n/a |
| False-fix rate | 0.0% [0–17.6], n=18 | 0.0% [0–2.7], n=136 |
| Regression rate | 0.0% [0–17.6], n=18 | 0.0% [0–2.7], n=136 |

## Eval (held out)

### Summary

| Metric | Value |
|---|---|
| Pages | 73 |
| Violations detected | 738 |
| Skipped (needs judgment, no model in this run) | 720 |
| Patches proposed | 18 |
| Patches verified | 18 |
| **Fix rate** (verified / detected) | **2.4% [1.5–3.8], n=738** |
| **Precision** (verified / proposed) | **100.0% [82.4–100], n=18** |
| False-fix rate (suspicious / (verified + suspicious)) | 0.0% |
| Regression rate (regressions / applied) | 0.0% |
| Mean cost per verified fix | 0 tokens |
| Total tokens | 0 |
| Mean time per page | 1.1 s |
| Subset violations left after applying the output patch | 715 of 738 |
| WCAG A/AA violations (all rules) before → after | 1161 → 1138 |

### By tier

Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.

| Tier | Proposed | Verified | Precision [95% CI] | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |
|---|---|---|---|---|---|---|---|---|
| 0 (codemod) | 18 | 18 | **100.0% [82.4–100], n=18** | 0 | 0 | 0 | 0 | 0 |
| 1 (model) | 0 | 0 | **n/a** | 0 | 0 | 0 | 0 | n/a |

### What the verifier adds

Every patch that applied cleanly, judged by weaker verifiers. "Shipped but rejected by the full verifier" counts patches a pipeline with that verifier would have put in the output and called fixed. The full verifier is the reference here, not ground truth: a patch it accepts can still be wrong in ways no automatic check sees.

| Tier | Verifier | Would ship | Shipped but rejected by the full verifier | Share of shipped |
|---|---|---:|---:|---|
| 0 (codemod) | none (shape validation only) | 18 | 0 | 0.0% [0–17.6], n=18 |
| 0 (codemod) | axe only | 18 | 0 | 0.0% [0–17.6], n=18 |
| 0 (codemod) | axe + source checks | 18 | 0 | 0.0% [0–17.6], n=18 |
| 0 (codemod) | full (+ accessibility tree, focus order, pixels) | 18 | 0 | 0.0% [0–17.6], n=18 |

### Outcomes

| Status | Count |
|---|---|
| verified | 18 |
| rejected_suspicious (see below; in the output patch unless --strict) | 0 |
| rejected_persists | 0 |
| rejected_regression | 0 |
| rejected_invalid (bad patch shape) | 0 |
| rejected_invalid (no usable model output) | 0 |
| rejected_apply_failed | 0 |
| skipped | 720 |

### By rule

| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision [95% CI] | False-fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| image-alt | 1.0.0 | 1 | 6 | 6 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| label | 1.0.0 | 0 | 2 | 0 | 2 | 2 | 100.0% | 100.0% [34.2–100], n=2 | 0.0% | 0.0% |
| heading-order | 1.0.0 | 0 | 28 | 20 | 8 | 8 | 28.6% | 100.0% [67.6–100], n=8 | 0.0% | 0.0% |
| aria-allowed-attr | 1.0.0 | 0 | 17 | 9 | 8 | 8 | 47.1% | 100.0% [67.6–100], n=8 | 0.0% | 0.0% |
| aria-required-attr | 1.0.0 | 1 | 6 | 6 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| aria-valid-attr-value | 1.0.0 | 0 | 2 | 2 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| color-contrast | 1.0.0 | 1 | 677 | 677 | 0 | 0 | 0.0% | n/a | n/a | n/a |

## Dev (used for tuning)

### Summary

| Metric | Value |
|---|---|
| Pages | 22 |
| Violations detected | 662 |
| Skipped (needs judgment, no model in this run) | 526 |
| Patches proposed | 136 |
| Patches verified | 136 |
| **Fix rate** (verified / detected) | **20.5% [17.6–23.8], n=662** |
| **Precision** (verified / proposed) | **100.0% [97.3–100], n=136** |
| False-fix rate (suspicious / (verified + suspicious)) | 0.0% |
| Regression rate (regressions / applied) | 0.0% |
| Mean cost per verified fix | 0 tokens |
| Total tokens | 0 |
| Mean time per page | 2.3 s |
| Subset violations left after applying the output patch | 504 of 662 |
| WCAG A/AA violations (all rules) before → after | 809 → 651 |

### By tier

Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.

| Tier | Proposed | Verified | Precision [95% CI] | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |
|---|---|---|---|---|---|---|---|---|
| 0 (codemod) | 136 | 136 | **100.0% [97.3–100], n=136** | 0 | 0 | 0 | 0 | 0 |
| 1 (model) | 0 | 0 | **n/a** | 0 | 0 | 0 | 0 | n/a |

### What the verifier adds

Every patch that applied cleanly, judged by weaker verifiers. "Shipped but rejected by the full verifier" counts patches a pipeline with that verifier would have put in the output and called fixed. The full verifier is the reference here, not ground truth: a patch it accepts can still be wrong in ways no automatic check sees.

| Tier | Verifier | Would ship | Shipped but rejected by the full verifier | Share of shipped |
|---|---|---:|---:|---|
| 0 (codemod) | none (shape validation only) | 136 | 0 | 0.0% [0–2.7], n=136 |
| 0 (codemod) | axe only | 136 | 0 | 0.0% [0–2.7], n=136 |
| 0 (codemod) | axe + source checks | 136 | 0 | 0.0% [0–2.7], n=136 |
| 0 (codemod) | full (+ accessibility tree, focus order, pixels) | 136 | 0 | 0.0% [0–2.7], n=136 |

### Outcomes

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

### By rule

| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision [95% CI] | False-fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| image-alt | 1.0.0 | 1 | 159 | 159 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| label | 1.0.0 | 0 | 55 | 50 | 5 | 5 | 9.1% | 100.0% [56.6–100], n=5 | 0.0% | 0.0% |
| heading-order | 1.0.0 | 0 | 7 | 3 | 4 | 4 | 57.1% | 100.0% [51–100], n=4 | 0.0% | 0.0% |
| aria-allowed-attr | 1.0.0 | 0 | 151 | 29 | 122 | 122 | 80.8% | 100.0% [96.9–100], n=122 | 0.0% | 0.0% |
| aria-required-attr | 1.0.0 | 1 | 34 | 34 | 0 | 0 | 0.0% | n/a | n/a | n/a |
| aria-valid-attr-value | 1.0.0 | 0 | 58 | 55 | 3 | 3 | 5.2% | 100.0% [43.8–100], n=3 | 0.0% | 0.0% |
| aria-roles | 1.0.0 | 0 | 17 | 15 | 2 | 2 | 11.8% | 100.0% [34.2–100], n=2 | 0.0% | 0.0% |
| color-contrast | 1.0.0 | 1 | 181 | 181 | 0 | 0 | 0.0% | n/a | n/a | n/a |

## By page

| Page | Set | Detected | Verified | Left after patch | WCAG A/AA before → after | Time |
|---|---|---|---|---|---|---|
| eval/axe-core/aria-allowed-attr-failures.html | eval | 23 | 8 | 13 | 33 → 23 | 1.8 s |
| eval/axe-core/aria-allowed-attr-incomplete.html | eval | 2 | 0 | 2 | 3 → 3 | 0.5 s |
| eval/axe-core/color-contrast-text-shadows.html | eval | 135 | 0 | 135 | 135 → 135 | 1.4 s |
| eval/axe-core/contrast-blending.html | eval | 3 | 0 | 3 | 3 → 3 | 1.1 s |
| eval/axe-core/contrast-code-highlighting.html | eval | 1 | 0 | 1 | 1 → 1 | 0.7 s |
| eval/axe-core/contrast-sticky-header.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/axe-core/heading-order-no-heading-page.html | eval | 0 | 0 | 0 | 1 → 1 | 1.6 s |
| eval/bootstrap-examples/album/index.html | eval | 0 | 0 | 0 | 6 → 6 | 1.2 s |
| eval/bootstrap-examples/blog/index.html | eval | 3 | 0 | 3 | 24 → 24 | 1.6 s |
| eval/bootstrap-examples/carousel/index.html | eval | 0 | 0 | 0 | 7 → 7 | 1.3 s |
| eval/bootstrap-examples/checkout/index.html | eval | 2 | 0 | 2 | 7 → 7 | 1.0 s |
| eval/bootstrap-examples/cover/index.html | eval | 3 | 0 | 3 | 5 → 5 | 0.9 s |
| eval/bootstrap-examples/dashboard/index.html | eval | 0 | 0 | 0 | 7 → 7 | 1.2 s |
| eval/bootstrap-examples/features/index.html | eval | 1 | 0 | 1 | 3 → 3 | 1.2 s |
| eval/bootstrap-examples/footers/index.html | eval | 0 | 0 | 0 | 42 → 42 | 1.4 s |
| eval/bootstrap-examples/headers/index.html | eval | 0 | 0 | 0 | 52 → 52 | 1.7 s |
| eval/bootstrap-examples/heroes/index.html | eval | 0 | 0 | 0 | 2 → 2 | 1.0 s |
| eval/bootstrap-examples/jumbotron/index.html | eval | 0 | 0 | 0 | 2 → 2 | 0.9 s |
| eval/bootstrap-examples/list-groups/index.html | eval | 2 | 0 | 2 | 4 → 4 | 1.0 s |
| eval/bootstrap-examples/modals/index.html | eval | 2 | 1 | 1 | 7 → 6 | 1.9 s |
| eval/bootstrap-examples/navbars/index.html | eval | 0 | 0 | 0 | 75 → 75 | 1.5 s |
| eval/bootstrap-examples/offcanvas-navbar/index.html | eval | 2 | 1 | 1 | 14 → 13 | 1.9 s |
| eval/bootstrap-examples/pricing/index.html | eval | 4 | 3 | 1 | 23 → 20 | 3.7 s |
| eval/bootstrap-examples/product/index.html | eval | 2 | 1 | 1 | 27 → 26 | 2.5 s |
| eval/bootstrap-examples/sidebars/index.html | eval | 0 | 0 | 0 | 33 → 33 | 1.0 s |
| eval/bootstrap-examples/sign-in/index.html | eval | 0 | 0 | 0 | 2 → 2 | 0.7 s |
| eval/bootstrap-examples/starter-template/index.html | eval | 0 | 0 | 0 | 11 → 11 | 0.9 s |
| eval/mdn/accessible-image.html | eval | 1 | 0 | 1 | 1 → 1 | 0.7 s |
| eval/mdn/assessment-start.html | eval | 2 | 0 | 2 | 11 → 11 | 1.1 s |
| eval/mdn/bad-form.html | eval | 2 | 2 | 0 | 2 → 0 | 2.0 s |
| eval/mdn/bad-links.html | eval | 0 | 0 | 0 | 0 → 0 | 0.8 s |
| eval/mdn/bad-semantics.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/mdn/bad-table.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/mdn/custom-controls-start.html | eval | 0 | 0 | 0 | 0 → 0 | 0.8 s |
| eval/mdn/form-css.html | eval | 0 | 0 | 0 | 0 → 0 | 0.6 s |
| eval/mdn/form-validation-checkbox-disabled.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/mdn/form-validation-updated.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/mdn/form-validation.html | eval | 0 | 0 | 0 | 0 → 0 | 0.6 s |
| eval/mdn/mouse-and-keyboard-events.html | eval | 0 | 0 | 0 | 0 → 0 | 0.6 s |
| eval/mdn/table-css.html | eval | 0 | 0 | 0 | 0 → 0 | 0.6 s |
| eval/startbootstrap/agency/index.html | eval | 7 | 0 | 7 | 7 → 7 | 1.6 s |
| eval/startbootstrap/blog-home/index.html | eval | 0 | 0 | 0 | 0 → 0 | 1.2 s |
| eval/startbootstrap/clean-blog/about.html | eval | 0 | 0 | 0 | 3 → 3 | 0.8 s |
| eval/startbootstrap/clean-blog/contact.html | eval | 1 | 0 | 1 | 4 → 4 | 1.0 s |
| eval/startbootstrap/clean-blog/index.html | eval | 1 | 0 | 1 | 4 → 4 | 1.1 s |
| eval/startbootstrap/clean-blog/post.html | eval | 0 | 0 | 0 | 3 → 3 | 1.1 s |
| eval/startbootstrap/creative/index.html | eval | 4 | 0 | 4 | 4 → 4 | 1.2 s |
| eval/startbootstrap/freelancer/index.html | eval | 8 | 0 | 8 | 12 → 12 | 1.2 s |
| eval/startbootstrap/grayscale/index.html | eval | 7 | 0 | 7 | 10 → 10 | 1.2 s |
| eval/startbootstrap/landing-page/index.html | eval | 7 | 0 | 7 | 10 → 10 | 1.2 s |
| eval/startbootstrap/modern-business/about.html | eval | 7 | 0 | 7 | 7 → 7 | 1.0 s |
| eval/startbootstrap/modern-business/blog-home.html | eval | 4 | 0 | 4 | 8 → 8 | 1.2 s |
| eval/startbootstrap/modern-business/blog-post.html | eval | 2 | 0 | 2 | 2 → 2 | 0.9 s |
| eval/startbootstrap/modern-business/contact.html | eval | 2 | 0 | 2 | 2 → 2 | 0.9 s |
| eval/startbootstrap/modern-business/faq.html | eval | 2 | 0 | 2 | 6 → 6 | 0.9 s |
| eval/startbootstrap/modern-business/index.html | eval | 1 | 0 | 1 | 1 → 1 | 1.0 s |
| eval/startbootstrap/modern-business/portfolio-item.html | eval | 0 | 0 | 0 | 0 → 0 | 0.8 s |
| eval/startbootstrap/modern-business/portfolio-overview.html | eval | 0 | 0 | 0 | 0 → 0 | 0.8 s |
| eval/startbootstrap/modern-business/pricing.html | eval | 1 | 0 | 1 | 1 → 1 | 0.9 s |
| eval/startbootstrap/new-age/index.html | eval | 3 | 0 | 3 | 3 → 3 | 1.2 s |
| eval/startbootstrap/resume/index.html | eval | 12 | 0 | 12 | 16 → 16 | 1.2 s |
| eval/startbootstrap/sb-admin-2/cards.html | eval | 20 | 0 | 20 | 26 → 26 | 1.0 s |
| eval/startbootstrap/sb-admin-2/index.html | eval | 50 | 1 | 47 | 63 → 60 | 1.9 s |
| eval/startbootstrap/sb-admin-2/login.html | eval | 5 | 0 | 5 | 5 → 5 | 0.7 s |
| eval/startbootstrap/sb-admin-2/register.html | eval | 4 | 0 | 4 | 4 → 4 | 0.6 s |
| eval/startbootstrap/sb-admin-2/tables.html | eval | 362 | 1 | 360 | 367 → 365 | 2.2 s |
| eval/startbootstrap/sb-admin/charts.html | eval | 11 | 0 | 11 | 15 → 15 | 0.8 s |
| eval/startbootstrap/sb-admin/index.html | eval | 10 | 0 | 10 | 14 → 14 | 1.0 s |
| eval/startbootstrap/sb-admin/login.html | eval | 4 | 0 | 4 | 4 → 4 | 0.5 s |
| eval/startbootstrap/sb-admin/register.html | eval | 4 | 0 | 4 | 4 → 4 | 0.6 s |
| eval/startbootstrap/sb-admin/tables.html | eval | 8 | 0 | 8 | 12 → 12 | 1.0 s |
| eval/startbootstrap/shop-homepage/index.html | eval | 1 | 0 | 1 | 1 → 1 | 0.7 s |
| eval/startbootstrap/small-business/index.html | eval | 0 | 0 | 0 | 0 → 0 | 0.6 s |
| external/axe-core/aria-allowed-attr.html | dev | 23 | 8 | 13 | 33 → 23 | 1.4 s |
| external/axe-core/aria-required-attr.html | dev | 16 | 0 | 16 | 24 → 24 | 0.5 s |
| external/axe-core/aria-roles.html | dev | 22 | 0 | 22 | 60 → 60 | 0.6 s |
| external/axe-core/aria-valid-attr-value.html | dev | 189 | 113 | 55 | 198 → 64 | 31.1 s |
| external/axe-core/color-contrast.html | dev | 22 | 0 | 22 | 28 → 28 | 0.8 s |
| external/axe-core/heading-order.html | dev | 3 | 0 | 3 | 3 → 3 | 0.5 s |
| external/axe-core/image-alt.html | dev | 19 | 0 | 19 | 22 → 22 | 0.5 s |
| external/axe-core/label.html | dev | 14 | 0 | 14 | 28 → 28 | 0.6 s |
| external/w3c-bad/home.html | dev | 71 | 0 | 71 | 84 → 84 | 1.0 s |
| external/w3c-bad/news.html | dev | 75 | 0 | 75 | 86 → 86 | 1.0 s |
| external/w3c-bad/survey.html | dev | 71 | 0 | 71 | 83 → 83 | 1.1 s |
| external/w3c-bad/tickets.html | dev | 70 | 0 | 70 | 81 → 81 | 1.0 s |
| handwritten/01-bakery-images.html | dev | 7 | 0 | 7 | 10 → 10 | 0.5 s |
| handwritten/02-newsletter-labels.html | dev | 4 | 3 | 1 | 5 → 2 | 1.4 s |
| handwritten/03-docs-headings.html | dev | 2 | 1 | 1 | 4 → 3 | 0.9 s |
| handwritten/04-dashboard-roles.html | dev | 7 | 2 | 5 | 7 → 5 | 1.3 s |
| handwritten/05-settings-aria-values.html | dev | 7 | 4 | 3 | 9 → 5 | 1.4 s |
| handwritten/06-pricing-contrast.html | dev | 7 | 0 | 7 | 7 → 7 | 0.5 s |
| handwritten/07-recipe-mixed.html | dev | 7 | 1 | 6 | 8 → 7 | 0.9 s |
| handwritten/08-portfolio-ambiguous.html | dev | 10 | 0 | 10 | 12 → 12 | 0.5 s |
| handwritten/09-event-signup.html | dev | 7 | 4 | 4 | 8 → 5 | 1.4 s |
| handwritten/10-coworking-crlf.html | dev | 9 | 0 | 9 | 9 → 9 | 0.5 s |

## Skipped

| Rule and reason | Count |
|---|---|
| color-contrast: needs judgment (tier-1 rule without codemod); no model configured | 858 |
| image-alt: needs judgment (tier-1 rule without codemod); no model configured | 165 |
| aria-valid-attr-value: codemod declined; no model configured | 57 |
| label: codemod declined; no model configured | 50 |
| aria-required-attr: needs judgment (tier-1 rule without codemod); no model configured | 40 |
| aria-allowed-attr: codemod declined; no model configured | 38 |
| aria-roles: codemod declined; no model configured | 15 |
| heading-order: codemod declined: its edit fails shape validation (diff has 3 hunks (max 2)); no model configured | 11 |
| heading-order: codemod declined: its edit fails shape validation (diff has 4 hunks (max 2)); no model configured | 8 |
| heading-order: codemod declined: its edit fails shape validation (diff has 8 hunks (max 2)); no model configured | 3 |
| heading-order: codemod declined; no model configured | 1 |

## Verifier checks

Every applied patch is compared with the original page: axe-core with the full WCAG 2.x A/AA rule set, static suspicion checks on the patched source, and:

- accessibility tree (computed role, name, states, focusability of every element): on
- focus order (Tab sequence): on
- visual (full-page screenshots): desktop 1280x900; limit 0.10% of pixels changed outside the patched elements; layout shifts measured, not enforced

| | Patches |
|---|---:|
| Compared beyond axe | 154 |
| Rejected by the accessibility-tree comparison | 0 |
| Rejected by the focus-order comparison | 0 |
| Rejected by the visual comparison | 0 |
| Moved other elements on the page (layout shift, reported only) | 12 |

Largest pixel change outside the patched elements on a page without layout shift: 0.000%.

## Definitions

- **Eval / dev**: pages under a directory named `eval` are held out: never used to write or tune codemods, rules, prompts or the verifier. All other pages are dev. A page used for tuning moves to dev.
- **Detected**: violations of the patched rule subset reported by axe-core, one per node.
- **Skipped**: no patch attempted: the rule's deterministic codemod declined (the fix needs judgment) and no model was configured.
- **Proposed**: a well-formed patch was produced, by a tier-0 codemod or by the tier-1 model (valid JSON matching the schema, within 3 attempts).
- **Applied**: the patch passed shape validation (exact `before` substring, ≤ 6 lines, ≤ 2 hunks) and the patched page was re-audited.
- **Verified**: after applying the patch to a copy, the original violation is gone from the target node, no new WCAG 2.x A/AA violation appeared anywhere on the page, and no suspicion check fired (static checks, plus the accessibility-tree, focus-order and visual comparisons when they ran).
- **False-fix rate**: of the patches that made axe happy, the share flagged as suspicious.
- **Regression rate**: of the applied patches, the share that introduced a new violation.
- **[95% CI]**: Wilson score interval. With samples this small, intervals are wide; differences inside them are not evidence.
- Token costs count input, output, and prompt-cache reads and writes. Dollar figures are estimates from list prices.

## Analysis

**Eval first.** On the 73 held-out eval pages, tier 0 proposed 18 patches (8 `heading-order`, 8 `aria-allowed-attr`,
2 `label`) and the verifier accepted all 18: 100% [82.4–100]. Eighteen patches cannot tell 100% from 85%, so this
says tier 0 did not fail on pages it was not written for, not that it never will. The eval fix rate is 2.4%
[1.5–3.8] (18 of 738): 677 of the 738 eval violations are `color-contrast`, which tier 0 never touches, and three
pages hold 547 of the 738. 29 of the 73 eval pages have no violation of the patched rules. The rest of this analysis
was written about the 22 dev pages, which were read while the codemods were written.

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
