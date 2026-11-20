# a11yfix benchmark report

- Mode: `llm` (cmd:node bench/baselines/naive-fixer.mjs)
- Corpus: `./corpus` (95 pages: 73 eval, held out; 22 dev, used for tuning)
- Engines: a11yfix-core 0.3.0, axe-core 4.14.1, playwright 1.65.1, node 26.13.1
- Run 2026-11-20, total wall time 3596.7 s

> a11yfix does not guarantee WCAG conformance. "Verified" means axe-core no longer reports the violation and nothing else broke; it is not a human review.

## Dev and eval

Dev pages were read and debugged while the codemods and prompts were written, so their numbers are optimistic. Eval pages (under `eval/`) were never used for tuning: quote those. Each set is reported in full below.

| Metric | Eval (held out) | Dev (used for tuning) |
|---|---|---|
| Pages | 73 | 22 |
| Violations detected | 738 | 662 |
| Patches verified | 619 | 403 |
| **Fix rate** (verified / detected) | 83.9% [81–86.4], n=738 | 60.9% [57.1–64.5], n=662 |
| **Precision** (verified / proposed) | 84.1% [81.3–86.6], n=736 | 61.7% [57.9–65.4], n=653 |
| Tier 0 precision | n/a | n/a |
| Tier 1 precision | 84.1% [81.3–86.6], n=736 | 61.7% [57.9–65.4], n=653 |
| False-fix rate | 2.4% [1.4–3.9], n=634 | 35.6% [32–39.5], n=626 |
| Regression rate | 1.8% [1–3], n=736 | 2.1% [1.3–3.6], n=653 |

## Eval (held out)

### Summary

| Metric | Value |
|---|---|
| Pages | 73 |
| Violations detected | 738 |
| Skipped (needs judgment, no model in this run) | 0 |
| Patches proposed | 736 |
| Patches verified | 619 |
| **Fix rate** (verified / detected) | **83.9% [81–86.4], n=738** |
| **Precision** (verified / proposed) | **84.1% [81.3–86.6], n=736** |
| False-fix rate (suspicious / (verified + suspicious)) | 2.4% |
| Regression rate (regressions / applied) | 1.8% |
| Mean cost per verified fix | 0 tokens |
| Total tokens | 0 |
| Mean time per page | 92.4 s |
| Subset violations left after applying the output patch | 107 of 738 |
| WCAG A/AA violations (all rules) before → after | 1161 → 528 |

### By tier

Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.

| Tier | Proposed | Verified | Precision [95% CI] | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |
|---|---|---|---|---|---|---|---|---|
| 0 (codemod) | 0 | 0 | **n/a** | 0 | 0 | 0 | 0 | n/a |
| 1 (model) | 736 | 619 | **84.1% [81.3–86.6], n=736** | 15 | 13 | 89 | 0 | 0 |

### Compared with `codemods only` (2026-11-20, eval pages)

| Metric | This run | codemods only |
|---|---|---|
| Fix rate | 83.9% | 2.4% |
| Precision | 84.1% | 100.0% |
| False-fix rate | 2.4% | 0.0% |
| Regression rate | 1.8% | 0.0% |

### What the verifier adds

Every patch that applied cleanly, judged by weaker verifiers. "Shipped but rejected by the full verifier" counts patches a pipeline with that verifier would have put in the output and called fixed. The full verifier is the reference here, not ground truth: a patch it accepts can still be wrong in ways no automatic check sees.

| Tier | Verifier | Would ship | Shipped but rejected by the full verifier | Share of shipped |
|---|---|---:|---:|---|
| 1 (model) | none (shape validation only) | 736 | 117 | 15.9% [13.4–18.7], n=736 |
| 1 (model) | axe only | 634 | 15 | 2.4% [1.4–3.9], n=634 |
| 1 (model) | axe + source checks | 623 | 4 | 0.6% [0.2–1.6], n=623 |
| 1 (model) | full (+ accessibility tree, focus order, pixels) | 619 | 0 | 0.0% [0–0.6], n=619 |

### Outcomes

| Status | Count |
|---|---|
| verified | 619 |
| rejected_suspicious (see below; in the output patch unless --strict) | 15 |
| rejected_persists | 89 |
| rejected_regression | 13 |
| rejected_invalid (bad patch shape) | 0 |
| rejected_invalid (no usable model output) | 2 |
| rejected_apply_failed | 0 |
| skipped | 0 |

### By rule

| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision [95% CI] | False-fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| image-alt | 1.0.0 | 1 | 6 | 0 | 6 | 0 | 0.0% | 0.0% [0–39], n=6 | 100.0% | 0.0% |
| label | 1.0.0 | 0 | 2 | 0 | 2 | 0 | 0.0% | 0.0% [0–65.8], n=2 | 100.0% | 0.0% |
| heading-order | 1.0.0 | 0 | 28 | 0 | 28 | 16 | 57.1% | 57.1% [39.1–73.5], n=28 | 11.1% | 35.7% |
| aria-allowed-attr | 1.0.0 | 0 | 17 | 0 | 15 | 11 | 64.7% | 73.3% [48–89.1], n=15 | 8.3% | 20.0% |
| aria-required-attr | 1.0.0 | 1 | 6 | 0 | 6 | 3 | 50.0% | 50.0% [18.8–81.2], n=6 | 50.0% | 0.0% |
| aria-valid-attr-value | 1.0.0 | 0 | 2 | 0 | 2 | 2 | 100.0% | 100.0% [34.2–100], n=2 | 0.0% | 0.0% |
| color-contrast | 1.0.0 | 1 | 677 | 0 | 677 | 587 | 86.7% | 86.7% [83.9–89.1], n=677 | 0.2% | 0.0% |

## Dev (used for tuning)

### Summary

| Metric | Value |
|---|---|
| Pages | 22 |
| Violations detected | 662 |
| Skipped (needs judgment, no model in this run) | 0 |
| Patches proposed | 653 |
| Patches verified | 403 |
| **Fix rate** (verified / detected) | **60.9% [57.1–64.5], n=662** |
| **Precision** (verified / proposed) | **61.7% [57.9–65.4], n=653** |
| False-fix rate (suspicious / (verified + suspicious)) | 35.6% |
| Regression rate (regressions / applied) | 2.1% |
| Mean cost per verified fix | 0 tokens |
| Total tokens | 0 |
| Mean time per page | 18.0 s |
| Subset violations left after applying the output patch | 43 of 662 |
| WCAG A/AA violations (all rules) before → after | 809 → 171 |

### By tier

Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.

| Tier | Proposed | Verified | Precision [95% CI] | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |
|---|---|---|---|---|---|---|---|---|
| 0 (codemod) | 0 | 0 | **n/a** | 0 | 0 | 0 | 0 | n/a |
| 1 (model) | 653 | 403 | **61.7% [57.9–65.4], n=653** | 223 | 14 | 13 | 0 | 0 |

### Compared with `codemods only` (2026-11-20, dev pages)

| Metric | This run | codemods only |
|---|---|---|
| Fix rate | 60.9% | 20.5% |
| Precision | 61.7% | 100.0% |
| False-fix rate | 35.6% | 0.0% |
| Regression rate | 2.1% | 0.0% |

### What the verifier adds

Every patch that applied cleanly, judged by weaker verifiers. "Shipped but rejected by the full verifier" counts patches a pipeline with that verifier would have put in the output and called fixed. The full verifier is the reference here, not ground truth: a patch it accepts can still be wrong in ways no automatic check sees.

| Tier | Verifier | Would ship | Shipped but rejected by the full verifier | Share of shipped |
|---|---|---:|---:|---|
| 1 (model) | none (shape validation only) | 653 | 250 | 38.3% [34.6–42.1], n=653 |
| 1 (model) | axe only | 626 | 223 | 35.6% [32–39.5], n=626 |
| 1 (model) | axe + source checks | 407 | 4 | 1.0% [0.4–2.5], n=407 |
| 1 (model) | full (+ accessibility tree, focus order, pixels) | 403 | 0 | 0.0% [0–0.9], n=403 |

### Outcomes

| Status | Count |
|---|---|
| verified | 403 |
| rejected_suspicious (see below; in the output patch unless --strict) | 223 |
| rejected_persists | 13 |
| rejected_regression | 14 |
| rejected_invalid (bad patch shape) | 0 |
| rejected_invalid (no usable model output) | 9 |
| rejected_apply_failed | 0 |
| skipped | 0 |

### By rule

| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision [95% CI] | False-fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| image-alt | 1.0.0 | 1 | 159 | 0 | 159 | 0 | 0.0% | 0.0% [0–2.4], n=159 | 100.0% | 0.6% |
| label | 1.0.0 | 0 | 55 | 0 | 55 | 2 | 3.6% | 3.6% [1–12.3], n=55 | 96.4% | 0.0% |
| heading-order | 1.0.0 | 0 | 7 | 0 | 7 | 6 | 85.7% | 85.7% [48.7–97.4], n=7 | 0.0% | 14.3% |
| aria-allowed-attr | 1.0.0 | 0 | 151 | 0 | 149 | 145 | 96.0% | 97.3% [93.3–99], n=149 | 0.7% | 2.0% |
| aria-required-attr | 1.0.0 | 1 | 34 | 0 | 34 | 22 | 64.7% | 64.7% [47.9–78.5], n=34 | 24.1% | 11.8% |
| aria-valid-attr-value | 1.0.0 | 0 | 58 | 0 | 51 | 43 | 74.1% | 84.3% [72–91.8], n=51 | 6.5% | 9.8% |
| aria-roles | 1.0.0 | 0 | 17 | 0 | 17 | 16 | 94.1% | 94.1% [73–99], n=17 | 5.9% | 0.0% |
| color-contrast | 1.0.0 | 1 | 181 | 0 | 181 | 169 | 93.4% | 93.4% [88.8–96.2], n=181 | 0.0% | 0.0% |

## By page

| Page | Set | Detected | Verified | Left after patch | WCAG A/AA before → after | Time |
|---|---|---|---|---|---|---|
| eval/axe-core/aria-allowed-attr-failures.html | eval | 23 | 14 | 9 | 33 → 19 | 6.2 s |
| eval/axe-core/aria-allowed-attr-incomplete.html | eval | 2 | 2 | 0 | 3 → 1 | 3.1 s |
| eval/axe-core/color-contrast-text-shadows.html | eval | 135 | 126 | 9 | 135 → 9 | 71.6 s |
| eval/axe-core/contrast-blending.html | eval | 3 | 3 | 0 | 3 → 0 | 69.7 s |
| eval/axe-core/contrast-code-highlighting.html | eval | 1 | 1 | 0 | 1 → 0 | 1.5 s |
| eval/axe-core/contrast-sticky-header.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/axe-core/heading-order-no-heading-page.html | eval | 0 | 0 | 0 | 1 → 1 | 1.6 s |
| eval/bootstrap-examples/album/index.html | eval | 0 | 0 | 0 | 6 → 6 | 1.0 s |
| eval/bootstrap-examples/blog/index.html | eval | 3 | 2 | 0 | 24 → 21 | 4.4 s |
| eval/bootstrap-examples/carousel/index.html | eval | 0 | 0 | 0 | 7 → 7 | 1.1 s |
| eval/bootstrap-examples/checkout/index.html | eval | 2 | 2 | 1 | 7 → 6 | 3.6 s |
| eval/bootstrap-examples/cover/index.html | eval | 3 | 3 | 0 | 5 → 2 | 2.8 s |
| eval/bootstrap-examples/dashboard/index.html | eval | 0 | 0 | 0 | 7 → 7 | 1.0 s |
| eval/bootstrap-examples/features/index.html | eval | 1 | 0 | 0 | 3 → 2 | 2.1 s |
| eval/bootstrap-examples/footers/index.html | eval | 0 | 0 | 0 | 42 → 42 | 1.0 s |
| eval/bootstrap-examples/headers/index.html | eval | 0 | 0 | 0 | 52 → 52 | 1.2 s |
| eval/bootstrap-examples/heroes/index.html | eval | 0 | 0 | 0 | 2 → 2 | 0.9 s |
| eval/bootstrap-examples/jumbotron/index.html | eval | 0 | 0 | 0 | 2 → 2 | 0.7 s |
| eval/bootstrap-examples/list-groups/index.html | eval | 2 | 0 | 2 | 4 → 4 | 3.1 s |
| eval/bootstrap-examples/modals/index.html | eval | 2 | 1 | 1 | 7 → 6 | 3.0 s |
| eval/bootstrap-examples/navbars/index.html | eval | 0 | 0 | 0 | 75 → 75 | 1.4 s |
| eval/bootstrap-examples/offcanvas-navbar/index.html | eval | 2 | 1 | 1 | 14 → 13 | 5.5 s |
| eval/bootstrap-examples/pricing/index.html | eval | 4 | 3 | 1 | 23 → 20 | 5.6 s |
| eval/bootstrap-examples/product/index.html | eval | 2 | 1 | 1 | 27 → 26 | 3.7 s |
| eval/bootstrap-examples/sidebars/index.html | eval | 0 | 0 | 0 | 33 → 33 | 1.1 s |
| eval/bootstrap-examples/sign-in/index.html | eval | 0 | 0 | 0 | 2 → 2 | 0.8 s |
| eval/bootstrap-examples/starter-template/index.html | eval | 0 | 0 | 0 | 11 → 11 | 0.8 s |
| eval/mdn/accessible-image.html | eval | 1 | 0 | 0 | 1 → 0 | 2.0 s |
| eval/mdn/assessment-start.html | eval | 2 | 0 | 0 | 11 → 9 | 5.2 s |
| eval/mdn/bad-form.html | eval | 2 | 0 | 0 | 2 → 0 | 3.8 s |
| eval/mdn/bad-links.html | eval | 0 | 0 | 0 | 0 → 0 | 0.9 s |
| eval/mdn/bad-semantics.html | eval | 0 | 0 | 0 | 0 → 0 | 0.9 s |
| eval/mdn/bad-table.html | eval | 0 | 0 | 0 | 0 → 0 | 1.0 s |
| eval/mdn/custom-controls-start.html | eval | 0 | 0 | 0 | 0 → 0 | 1.1 s |
| eval/mdn/form-css.html | eval | 0 | 0 | 0 | 0 → 0 | 1.0 s |
| eval/mdn/form-validation-checkbox-disabled.html | eval | 0 | 0 | 0 | 0 → 0 | 0.9 s |
| eval/mdn/form-validation-updated.html | eval | 0 | 0 | 0 | 0 → 0 | 1.0 s |
| eval/mdn/form-validation.html | eval | 0 | 0 | 0 | 0 → 0 | 1.0 s |
| eval/mdn/mouse-and-keyboard-events.html | eval | 0 | 0 | 0 | 0 → 0 | 0.8 s |
| eval/mdn/table-css.html | eval | 0 | 0 | 0 | 0 → 0 | 0.9 s |
| eval/startbootstrap/agency/index.html | eval | 7 | 1 | 6 | 7 → 6 | 6.2 s |
| eval/startbootstrap/blog-home/index.html | eval | 0 | 0 | 0 | 0 → 0 | 1.1 s |
| eval/startbootstrap/clean-blog/about.html | eval | 0 | 0 | 0 | 3 → 3 | 0.9 s |
| eval/startbootstrap/clean-blog/contact.html | eval | 1 | 0 | 1 | 4 → 4 | 3.3 s |
| eval/startbootstrap/clean-blog/index.html | eval | 1 | 1 | 0 | 4 → 3 | 1.8 s |
| eval/startbootstrap/clean-blog/post.html | eval | 0 | 0 | 0 | 3 → 3 | 0.9 s |
| eval/startbootstrap/creative/index.html | eval | 4 | 1 | 3 | 4 → 3 | 4.9 s |
| eval/startbootstrap/freelancer/index.html | eval | 8 | 5 | 2 | 12 → 6 | 5.1 s |
| eval/startbootstrap/grayscale/index.html | eval | 7 | 4 | 3 | 10 → 6 | 6.0 s |
| eval/startbootstrap/landing-page/index.html | eval | 7 | 5 | 2 | 10 → 5 | 5.5 s |
| eval/startbootstrap/modern-business/about.html | eval | 7 | 0 | 7 | 7 → 7 | 4.3 s |
| eval/startbootstrap/modern-business/blog-home.html | eval | 4 | 1 | 3 | 8 → 7 | 4.6 s |
| eval/startbootstrap/modern-business/blog-post.html | eval | 2 | 0 | 2 | 2 → 2 | 3.0 s |
| eval/startbootstrap/modern-business/contact.html | eval | 2 | 0 | 2 | 2 → 2 | 2.8 s |
| eval/startbootstrap/modern-business/faq.html | eval | 2 | 1 | 1 | 6 → 5 | 3.0 s |
| eval/startbootstrap/modern-business/index.html | eval | 1 | 0 | 1 | 1 → 1 | 2.1 s |
| eval/startbootstrap/modern-business/portfolio-item.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| eval/startbootstrap/modern-business/portfolio-overview.html | eval | 0 | 0 | 0 | 0 → 0 | 0.8 s |
| eval/startbootstrap/modern-business/pricing.html | eval | 1 | 0 | 1 | 1 → 1 | 2.0 s |
| eval/startbootstrap/new-age/index.html | eval | 3 | 1 | 2 | 3 → 2 | 4.5 s |
| eval/startbootstrap/resume/index.html | eval | 12 | 6 | 6 | 16 → 10 | 7.6 s |
| eval/startbootstrap/sb-admin-2/cards.html | eval | 20 | 10 | 9 | 26 → 15 | 9.5 s |
| eval/startbootstrap/sb-admin-2/index.html | eval | 50 | 30 | 18 | 63 → 30 | 24.9 s |
| eval/startbootstrap/sb-admin-2/login.html | eval | 5 | 4 | 1 | 5 → 1 | 22.0 s |
| eval/startbootstrap/sb-admin-2/register.html | eval | 4 | 3 | 1 | 4 → 1 | 5.3 s |
| eval/startbootstrap/sb-admin-2/tables.html | eval | 362 | 359 | 1 | 367 → 5 | 3187.8 s |
| eval/startbootstrap/sb-admin/charts.html | eval | 11 | 7 | 4 | 15 → 8 | 3184.4 s |
| eval/startbootstrap/sb-admin/index.html | eval | 10 | 8 | 2 | 14 → 6 | 6.7 s |
| eval/startbootstrap/sb-admin/login.html | eval | 4 | 3 | 1 | 4 → 1 | 4.4 s |
| eval/startbootstrap/sb-admin/register.html | eval | 4 | 3 | 1 | 4 → 1 | 2.9 s |
| eval/startbootstrap/sb-admin/tables.html | eval | 8 | 7 | 1 | 12 → 5 | 5.5 s |
| eval/startbootstrap/shop-homepage/index.html | eval | 1 | 0 | 1 | 1 → 1 | 3.5 s |
| eval/startbootstrap/small-business/index.html | eval | 0 | 0 | 0 | 0 → 0 | 0.7 s |
| external/axe-core/aria-allowed-attr.html | dev | 23 | 14 | 9 | 33 → 19 | 5.9 s |
| external/axe-core/aria-required-attr.html | dev | 16 | 7 | 6 | 24 → 14 | 7.0 s |
| external/axe-core/aria-roles.html | dev | 22 | 20 | 1 | 60 → 39 | 7.3 s |
| external/axe-core/aria-valid-attr-value.html | dev | 189 | 170 | 8 | 198 → 17 | 62.2 s |
| external/axe-core/color-contrast.html | dev | 22 | 3 | 11 | 28 → 17 | 61.9 s |
| external/axe-core/heading-order.html | dev | 3 | 1 | 2 | 3 → 2 | 5.1 s |
| external/axe-core/image-alt.html | dev | 19 | 3 | 1 | 22 → 4 | 6.9 s |
| external/axe-core/label.html | dev | 14 | 0 | 0 | 28 → 14 | 6.7 s |
| external/w3c-bad/home.html | dev | 71 | 38 | 0 | 84 → 9 | 48.8 s |
| external/w3c-bad/news.html | dev | 75 | 36 | 0 | 86 → 7 | 49.1 s |
| external/w3c-bad/survey.html | dev | 71 | 36 | 0 | 83 → 8 | 49.4 s |
| external/w3c-bad/tickets.html | dev | 70 | 44 | 0 | 81 → 7 | 49.4 s |
| handwritten/01-bakery-images.html | dev | 7 | 0 | 1 | 10 → 3 | 3.1 s |
| handwritten/02-newsletter-labels.html | dev | 4 | 1 | 0 | 5 → 1 | 3.0 s |
| handwritten/03-docs-headings.html | dev | 2 | 2 | 0 | 4 → 2 | 3.1 s |
| handwritten/04-dashboard-roles.html | dev | 7 | 5 | 0 | 7 → 0 | 3.2 s |
| handwritten/05-settings-aria-values.html | dev | 7 | 4 | 1 | 9 → 3 | 3.8 s |
| handwritten/06-pricing-contrast.html | dev | 7 | 6 | 1 | 7 → 1 | 3.4 s |
| handwritten/07-recipe-mixed.html | dev | 7 | 5 | 1 | 8 → 2 | 4.0 s |
| handwritten/08-portfolio-ambiguous.html | dev | 10 | 0 | 0 | 12 → 0 | 4.4 s |
| handwritten/09-event-signup.html | dev | 7 | 4 | 1 | 8 → 2 | 3.9 s |
| handwritten/10-coworking-crlf.html | dev | 9 | 4 | 0 | 9 → 0 | 3.9 s |

## Suspicious patches

These passed axe but tripped a suspicion check: they may silence the rule instead of fixing the problem. They are included in the output patch, marked, unless `--strict` is set. Review them first.

| Page | Finding | Rule | Tier | Status | Why |
|---|---|---|---|---|---|
| eval/axe-core/aria-allowed-attr-failures.html | f_0009 (line 26) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| eval/axe-core/aria-allowed-attr-failures.html | f_0011 (line 27) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| eval/axe-core/aria-allowed-attr-failures.html | f_0013 (line 28) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| eval/axe-core/aria-allowed-attr-failures.html | f_0019 (line 40) | aria-allowed-attr | 1 | rejected_suspicious | accessibility tree: <button> (line 40) lost its pressed state |
| eval/bootstrap-examples/blog/index.html | f_0002 (line 634) | heading-order | 1 | rejected_suspicious | visual (desktop): 0.33% of the page changed outside the patched elements (limit 0.10%) |
| eval/bootstrap-examples/features/index.html | f_0001 (line 749) | heading-order | 1 | rejected_suspicious | visual (desktop): 0.21% of the page changed outside the patched elements (limit 0.10%) |
| eval/mdn/accessible-image.html | f_0001 (line 18) | image-alt | 1 | rejected_suspicious | text alternative "dinosaur" only restates the file name "dinosaur.png"; accessibility tree: <img> (line 18) has a name that only restates its file name: "dinosaur" |
| eval/mdn/assessment-start.html | f_0001 (line 82) | image-alt | 1 | rejected_suspicious | text alternative "wild bear" only restates the file name "wild-bear.jpg"; accessibility tree: <img> (line 82) has a name that only restates its file name: "wild bear" |
| eval/mdn/assessment-start.html | f_0002 (line 86) | image-alt | 1 | rejected_suspicious | text alternative "urban bear" only restates the file name "urban-bear.jpg"; accessibility tree: <img> (line 86) has a name that only restates its file name: "urban bear" |
| eval/mdn/bad-form.html | f_0001 (line 13) | label | 1 | rejected_suspicious | aria-label "name" only restates the name attribute "name" and does not contain the visible text next to the <input> |
| eval/mdn/bad-form.html | f_0002 (line 17) | label | 1 | rejected_suspicious | aria-label "age" only restates the name attribute "age" and does not contain the visible text next to the <input> |
| eval/startbootstrap/freelancer/index.html | f_0005 (line 138) | color-contrast | 1 | rejected_suspicious | visual (desktop): 0.15% of the page changed outside the patched elements (limit 0.10%) |
| eval/startbootstrap/sb-admin-2/cards.html | f_0005 (line 328) | image-alt | 1 | rejected_suspicious | text alternative "undraw profile" only restates the file name "undraw_profile.svg"; accessibility tree: <img> (line 328) has a name that only restates its file name: "undraw profile" |
| eval/startbootstrap/sb-admin-2/index.html | f_0004 (line 334) | image-alt | 1 | rejected_suspicious | text alternative "undraw profile" only restates the file name "undraw_profile.svg"; accessibility tree: <img> (line 334) has a name that only restates its file name: "undraw profile" |
| eval/startbootstrap/sb-admin-2/tables.html | f_0003 (line 332) | image-alt | 1 | rejected_suspicious | text alternative "undraw profile" only restates the file name "undraw_profile.svg"; accessibility tree: <img> (line 332) has a name that only restates its file name: "undraw profile" |
| external/axe-core/aria-allowed-attr.html | f_0009 (line 26) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| external/axe-core/aria-allowed-attr.html | f_0011 (line 27) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| external/axe-core/aria-allowed-attr.html | f_0013 (line 28) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| external/axe-core/aria-allowed-attr.html | f_0019 (line 40) | aria-allowed-attr | 1 | rejected_suspicious | accessibility tree: <button> (line 40) lost its pressed state |
| external/axe-core/aria-required-attr.html | f_0005 (line 52) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| external/axe-core/aria-required-attr.html | f_0007 (line 63) | label | 1 | rejected_suspicious | aria-label "pass9" only restates the id attribute "pass9" and does not contain the visible text next to the <input> |
| external/axe-core/aria-required-attr.html | f_0008 (line 64) | label | 1 | rejected_suspicious | aria-label "pass10" only restates the id attribute "pass10" and does not contain the visible text next to the <input> |
| external/axe-core/aria-required-attr.html | f_0014 (line 83) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| external/axe-core/aria-roles.html | f_0002 (line 23) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| external/axe-core/aria-valid-attr-value.html | f_0012 (line 27) | aria-valid-attr-value | 1 | rejected_suspicious | accessibility tree: <div> (line 27) lost its disabled state |
| external/axe-core/aria-valid-attr-value.html | f_0066 (line 68) | label | 1 | rejected_suspicious | aria-label "violation43" only restates the id attribute "violation43" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0068 (line 78) | label | 1 | rejected_suspicious | aria-label "violation44" only restates the id attribute "violation44" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0070 (line 88) | label | 1 | rejected_suspicious | aria-label "violation45" only restates the id attribute "violation45" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0072 (line 98) | label | 1 | rejected_suspicious | aria-label "violation46" only restates the id attribute "violation46" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0074 (line 109) | label | 1 | rejected_suspicious | aria-label "violation47" only restates the id attribute "violation47" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0076 (line 121) | label | 1 | rejected_suspicious | aria-label "violation48" only restates the id attribute "violation48" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0180 (line 359) | label | 1 | rejected_suspicious | aria-label "pass187" only restates the id attribute "pass187" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0181 (line 370) | label | 1 | rejected_suspicious | aria-label "pass189" only restates the id attribute "pass189" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0182 (line 379) | label | 1 | rejected_suspicious | aria-label "pass190" only restates the id attribute "pass190" and does not contain the visible text next to the <input> |
| external/axe-core/aria-valid-attr-value.html | f_0184 (line 394) | label | 1 | rejected_suspicious | aria-label "pass192" only restates the id attribute "pass192" and does not contain the visible text next to the <input> |
| external/axe-core/color-contrast.html | f_0006 (line 95) | label | 1 | rejected_suspicious | aria-label "ignore1" only restates the id attribute "ignore1" and does not contain the visible text next to the <input> |
| external/axe-core/color-contrast.html | f_0007 (line 101) | label | 1 | rejected_suspicious | aria-label "ignore2" only restates the id attribute "ignore2" and does not contain the visible text next to the <input> |
| external/axe-core/color-contrast.html | f_0008 (line 211) | label | 1 | rejected_suspicious | aria-label "canttell6" only restates the id attribute "canttell6" and does not contain the visible text next to the <input> |
| external/axe-core/color-contrast.html | f_0009 (line 238) | label | 1 | rejected_suspicious | aria-label "canttell11" only restates the id attribute "canttell11" and does not contain the visible text next to the <textarea> |
| external/axe-core/color-contrast.html | f_0010 (line 257) | label | 1 | rejected_suspicious | aria-label "canttell15" only restates the id attribute "canttell15" and does not contain the visible text next to the <input> |
| external/axe-core/color-contrast.html | f_0017 (line 521) | label | 1 | rejected_suspicious | aria-label "pass24" only restates the id attribute "pass24" and does not contain the visible text next to the <textarea> |
| external/axe-core/color-contrast.html | f_0020 (line 567) | label | 1 | rejected_suspicious | aria-label "canttell24" only restates the id attribute "canttell24" and does not contain the visible text next to the <input> |
| external/axe-core/color-contrast.html | f_0022 (line 590) | label | 1 | rejected_suspicious | aria-label "fail15" only restates the id attribute "fail15" and does not contain the visible text next to the <input> |
| external/axe-core/image-alt.html | f_0001 (line 16) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 16) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0002 (line 17) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 17) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0003 (line 18) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 18) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0004 (line 19) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 19) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0005 (line 24) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 24) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0006 (line 29) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 29) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0007 (line 31) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 31) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0008 (line 32) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 32) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0009 (line 33) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 33) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0010 (line 34) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 34) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0011 (line 36) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 36) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0013 (line 37) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 37) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0016 (line 46) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 46) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0017 (line 47) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 47) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0018 (line 48) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 48) now has a generic name "img" |
| external/axe-core/image-alt.html | f_0019 (line 50) | image-alt | 1 | rejected_suspicious | generic alt: "image"; accessibility tree: <img> (line 50) now has a generic name "image" |
| external/axe-core/label.html | f_0001 (line 20) | label | 1 | rejected_suspicious | aria-label "fail1" only restates the id attribute "fail1" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0002 (line 21) | label | 1 | rejected_suspicious | aria-label "fail2" only restates the id attribute "fail2" and does not contain the visible text next to the <textarea> |
| external/axe-core/label.html | f_0003 (line 30) | label | 1 | rejected_suspicious | aria-label "fail3" only restates the id attribute "fail3" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0004 (line 31) | label | 1 | rejected_suspicious | aria-label "fail4" only restates the id attribute "fail4" and does not contain the visible text next to the <textarea> |
| external/axe-core/label.html | f_0005 (line 32) | label | 1 | rejected_suspicious | aria-label "fail5" only restates the id attribute "fail5" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0006 (line 33) | label | 1 | rejected_suspicious | aria-label "fail6" only restates the id attribute "fail6" and does not contain the visible text next to the <textarea> |
| external/axe-core/label.html | f_0007 (line 36) | label | 1 | rejected_suspicious | aria-label "fail7" only restates the id attribute "fail7" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0008 (line 44) | label | 1 | rejected_suspicious | aria-label "fail8" only restates the id attribute "fail8" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0009 (line 76) | label | 1 | rejected_suspicious | aria-label "fail9" only restates the id attribute "fail9" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0010 (line 77) | label | 1 | rejected_suspicious | aria-label "fail10" only restates the id attribute "fail10" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0011 (line 79) | label | 1 | rejected_suspicious | aria-label "fail11" only restates the id attribute "fail11" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0012 (line 81) | label | 1 | rejected_suspicious | aria-label "fail12" only restates the id attribute "fail12" and does not contain the visible text next to the <textarea> |
| external/axe-core/label.html | f_0013 (line 93) | label | 1 | rejected_suspicious | aria-label "fail13" only restates the id attribute "fail13" and does not contain the visible text next to the <input> |
| external/axe-core/label.html | f_0014 (line 101) | label | 1 | rejected_suspicious | aria-label "fail14" only restates the id attribute "fail14" and does not contain the visible text next to the <input> |
| external/w3c-bad/home.html | f_0014 (line 178) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 178) has a name that only restates its file name: "border left top" |
| external/w3c-bad/home.html | f_0015 (line 179) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 179) has a name that only restates its file name: "border top" |
| external/w3c-bad/home.html | f_0016 (line 180) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 180) has a name that only restates its file name: "border right top" |
| external/w3c-bad/home.html | f_0017 (line 183) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 183) has a name that only restates its file name: "border left" |
| external/w3c-bad/home.html | f_0018 (line 188) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 188) has a name that only restates its file name: "top logo next end" |
| external/w3c-bad/home.html | f_0019 (line 189) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 189) has a name that only restates its file name: "top weather" |
| external/w3c-bad/home.html | f_0020 (line 190) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 190) has a name that only restates its file name: "top logo next start" |
| external/w3c-bad/home.html | f_0021 (line 213) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 213) has a name that only restates its file name: "mark" |
| external/w3c-bad/home.html | f_0022 (line 238) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 238) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0023 (line 249) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 249) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0024 (line 250) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 250) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/home.html | f_0025 (line 253) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 253) has a name that only restates its file name: "nav home" |
| external/w3c-bad/home.html | f_0026 (line 256) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 256) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0027 (line 259) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 259) has a name that only restates its file name: "nav news" |
| external/w3c-bad/home.html | f_0028 (line 262) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 262) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0029 (line 265) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 265) has a name that only restates its file name: "nav facts" |
| external/w3c-bad/home.html | f_0030 (line 268) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 268) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0031 (line 271) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 271) has a name that only restates its file name: "nav survey" |
| external/w3c-bad/home.html | f_0032 (line 274) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 274) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0033 (line 278) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 278) has a name that only restates its file name: "blank 5x5" |
| external/w3c-bad/home.html | f_0034 (line 285) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 285) has a name that only restates its file name: "headline middle" |
| external/w3c-bad/home.html | f_0035 (line 286) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 286) has a name that only restates its file name: "headline middle" |
| external/w3c-bad/home.html | f_0036 (line 287) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 287) has a name that only restates its file name: "headline middle" |
| external/w3c-bad/home.html | f_0037 (line 306) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 306) has a name that only restates its file name: "blank 5x5" |
| external/w3c-bad/home.html | f_0038 (line 310) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 310) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/home.html | f_0039 (line 311) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 311) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0041 (line 317) | image-alt | 1 | rejected_suspicious | text alternative "teaser right1" only restates the file name "teaser_right1.jpg"; accessibility tree: <img> (line 317) has a name that only restates its file name: "teaser right1" |
| external/w3c-bad/home.html | f_0042 (line 332) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 332) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/home.html | f_0044 (line 338) | image-alt | 1 | rejected_suspicious | text alternative "teaser right2" only restates the file name "teaser_right2.jpg"; accessibility tree: <img> (line 338) has a name that only restates its file name: "teaser right2" |
| external/w3c-bad/home.html | f_0045 (line 359) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 359) has a name that only restates its file name: "border right" |
| external/w3c-bad/home.html | f_0046 (line 362) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 362) has a name that only restates its file name: "border bottom left" |
| external/w3c-bad/home.html | f_0047 (line 363) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 363) has a name that only restates its file name: "border bottom" |
| external/w3c-bad/home.html | f_0048 (line 364) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 364) has a name that only restates its file name: "border bottom right" |
| external/w3c-bad/news.html | f_0014 (line 80) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 80) has a name that only restates its file name: "border left top" |
| external/w3c-bad/news.html | f_0015 (line 81) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 81) has a name that only restates its file name: "border top" |
| external/w3c-bad/news.html | f_0016 (line 82) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 82) has a name that only restates its file name: "border right top" |
| external/w3c-bad/news.html | f_0017 (line 85) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 85) has a name that only restates its file name: "border left" |
| external/w3c-bad/news.html | f_0018 (line 90) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 90) has a name that only restates its file name: "top logo next end" |
| external/w3c-bad/news.html | f_0019 (line 91) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 91) has a name that only restates its file name: "top weather" |
| external/w3c-bad/news.html | f_0020 (line 92) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 92) has a name that only restates its file name: "top logo next start" |
| external/w3c-bad/news.html | f_0021 (line 115) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 115) has a name that only restates its file name: "mark" |
| external/w3c-bad/news.html | f_0022 (line 140) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 140) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0023 (line 151) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 151) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0024 (line 152) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 152) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0025 (line 155) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 155) has a name that only restates its file name: "nav home" |
| external/w3c-bad/news.html | f_0026 (line 158) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 158) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0027 (line 161) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 161) has a name that only restates its file name: "nav news" |
| external/w3c-bad/news.html | f_0028 (line 164) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 164) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0029 (line 167) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 167) has a name that only restates its file name: "nav facts" |
| external/w3c-bad/news.html | f_0030 (line 170) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 170) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0031 (line 173) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 173) has a name that only restates its file name: "nav survey" |
| external/w3c-bad/news.html | f_0032 (line 176) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 176) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0033 (line 180) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 180) has a name that only restates its file name: "blank 5x5" |
| external/w3c-bad/news.html | f_0034 (line 197) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 197) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0035 (line 198) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 198) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0036 (line 201) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 201) has a name that only restates its file name: "headline middle" |
| external/w3c-bad/news.html | f_0037 (line 202) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 202) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0038 (line 207) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 207) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0039 (line 218) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 218) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0040 (line 219) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 219) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0041 (line 220) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 220) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0042 (line 223) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 223) has a name that only restates its file name: "headline middle" |
| external/w3c-bad/news.html | f_0043 (line 228) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 228) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0044 (line 241) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 241) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0045 (line 242) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 242) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0046 (line 243) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 243) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/news.html | f_0047 (line 246) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 246) has a name that only restates its file name: "headline middle" |
| external/w3c-bad/news.html | f_0048 (line 251) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 251) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/news.html | f_0049 (line 268) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 268) has a name that only restates its file name: "border right" |
| external/w3c-bad/news.html | f_0050 (line 271) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 271) has a name that only restates its file name: "border bottom left" |
| external/w3c-bad/news.html | f_0051 (line 272) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 272) has a name that only restates its file name: "border bottom" |
| external/w3c-bad/news.html | f_0052 (line 273) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 273) has a name that only restates its file name: "border bottom right" |
| external/w3c-bad/survey.html | f_0014 (line 81) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 81) has a name that only restates its file name: "border left top" |
| external/w3c-bad/survey.html | f_0015 (line 82) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 82) has a name that only restates its file name: "border top" |
| external/w3c-bad/survey.html | f_0016 (line 83) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 83) has a name that only restates its file name: "border right top" |
| external/w3c-bad/survey.html | f_0017 (line 86) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 86) has a name that only restates its file name: "border left" |
| external/w3c-bad/survey.html | f_0018 (line 91) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 91) has a name that only restates its file name: "top logo next end" |
| external/w3c-bad/survey.html | f_0019 (line 92) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 92) has a name that only restates its file name: "top weather" |
| external/w3c-bad/survey.html | f_0020 (line 93) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 93) has a name that only restates its file name: "top logo next start" |
| external/w3c-bad/survey.html | f_0021 (line 116) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 116) has a name that only restates its file name: "mark" |
| external/w3c-bad/survey.html | f_0022 (line 141) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 141) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/survey.html | f_0023 (line 152) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 152) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/survey.html | f_0024 (line 153) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 153) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/survey.html | f_0025 (line 156) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 156) has a name that only restates its file name: "nav home" |
| external/w3c-bad/survey.html | f_0026 (line 159) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 159) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/survey.html | f_0027 (line 162) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 162) has a name that only restates its file name: "nav news" |
| external/w3c-bad/survey.html | f_0028 (line 165) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 165) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/survey.html | f_0029 (line 168) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 168) has a name that only restates its file name: "nav facts" |
| external/w3c-bad/survey.html | f_0030 (line 171) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 171) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/survey.html | f_0031 (line 174) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 174) has a name that only restates its file name: "nav survey" |
| external/w3c-bad/survey.html | f_0032 (line 177) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 177) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/survey.html | f_0033 (line 181) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 181) has a name that only restates its file name: "blank 5x5" |
| external/w3c-bad/survey.html | f_0034 (line 205) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0035 (line 209) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0036 (line 213) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0037 (line 237) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0038 (line 241) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0039 (line 245) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0040 (line 518) | label | 1 | rejected_suspicious | generic aria-label: "t"; aria-label "t" only restates the name attribute "t" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0041 (line 518) | label | 1 | rejected_suspicious | generic aria-label: "t"; aria-label "t" only restates the name attribute "t" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0042 (line 518) | label | 1 | rejected_suspicious | aria-label "em" only restates the name attribute "em" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0043 (line 520) | label | 1 | rejected_suspicious | generic aria-label: "n"; aria-label "n" only restates the name attribute "n" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0044 (line 520) | label | 1 | rejected_suspicious | aria-label "ev" only restates the name attribute "ev" and does not contain the visible text next to the <input> |
| external/w3c-bad/survey.html | f_0045 (line 588) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 588) has a name that only restates its file name: "border right" |
| external/w3c-bad/survey.html | f_0046 (line 591) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 591) has a name that only restates its file name: "border bottom left" |
| external/w3c-bad/survey.html | f_0047 (line 592) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 592) has a name that only restates its file name: "border bottom" |
| external/w3c-bad/survey.html | f_0048 (line 593) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 593) has a name that only restates its file name: "border bottom right" |
| external/w3c-bad/tickets.html | f_0014 (line 75) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 75) has a name that only restates its file name: "border left top" |
| external/w3c-bad/tickets.html | f_0015 (line 76) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 76) has a name that only restates its file name: "border top" |
| external/w3c-bad/tickets.html | f_0016 (line 77) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 77) has a name that only restates its file name: "border right top" |
| external/w3c-bad/tickets.html | f_0017 (line 80) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 80) has a name that only restates its file name: "border left" |
| external/w3c-bad/tickets.html | f_0018 (line 85) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 85) has a name that only restates its file name: "top logo next end" |
| external/w3c-bad/tickets.html | f_0019 (line 86) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 86) has a name that only restates its file name: "top weather" |
| external/w3c-bad/tickets.html | f_0020 (line 87) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 87) has a name that only restates its file name: "top logo next start" |
| external/w3c-bad/tickets.html | f_0021 (line 110) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 110) has a name that only restates its file name: "mark" |
| external/w3c-bad/tickets.html | f_0022 (line 135) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 135) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/tickets.html | f_0023 (line 146) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 146) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/tickets.html | f_0024 (line 147) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 147) has a name that only restates its file name: "marker2 t" |
| external/w3c-bad/tickets.html | f_0025 (line 150) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 150) has a name that only restates its file name: "nav home" |
| external/w3c-bad/tickets.html | f_0026 (line 153) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 153) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/tickets.html | f_0027 (line 156) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 156) has a name that only restates its file name: "nav news" |
| external/w3c-bad/tickets.html | f_0028 (line 159) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 159) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/tickets.html | f_0029 (line 162) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 162) has a name that only restates its file name: "nav facts" |
| external/w3c-bad/tickets.html | f_0030 (line 165) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 165) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/tickets.html | f_0031 (line 168) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 168) has a name that only restates its file name: "nav survey" |
| external/w3c-bad/tickets.html | f_0032 (line 171) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 171) has a name that only restates its file name: "marker2 w" |
| external/w3c-bad/tickets.html | f_0033 (line 175) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 175) has a name that only restates its file name: "blank 5x5" |
| external/w3c-bad/tickets.html | f_0034 (line 177) | image-alt | 1 | rejected_suspicious | text alternative "headline ticket offers" only restates the file name "headline_ticket_offers.gif"; accessibility tree: <img> (line 177) has a name that only restates its file name: "headline ticket offers" |
| external/w3c-bad/tickets.html | f_0037 (line 206) | image-alt | 1 | rejected_suspicious | text alternative "headline ticket prices" only restates the file name "headline_ticket_prices.gif"; accessibility tree: <img> (line 206) has a name that only restates its file name: "headline ticket prices" |
| external/w3c-bad/tickets.html | f_0044 (line 287) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 287) has a name that only restates its file name: "border right" |
| external/w3c-bad/tickets.html | f_0045 (line 290) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 290) has a name that only restates its file name: "border bottom left" |
| external/w3c-bad/tickets.html | f_0046 (line 291) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 291) has a name that only restates its file name: "border bottom" |
| external/w3c-bad/tickets.html | f_0047 (line 292) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 292) has a name that only restates its file name: "border bottom right" |
| handwritten/01-bakery-images.html | f_0002 (line 26) | image-alt | 1 | rejected_suspicious | text alternative "sourdough" only restates the file name "sourdough.jpg"; accessibility tree: <img> (line 26) has a name that only restates its file name: "sourdough"; visual (desktop): 0.13% of the page changed outside  |
| handwritten/01-bakery-images.html | f_0003 (line 30) | image-alt | 1 | rejected_suspicious | text alternative "croissant" only restates the file name "croissant.jpg"; accessibility tree: <img> (line 30) has a name that only restates its file name: "croissant" |
| handwritten/01-bakery-images.html | f_0004 (line 34) | image-alt | 1 | rejected_suspicious | text alternative "wheat divider" only restates the file name "wheat-divider.png"; accessibility tree: <img> (line 34) has a name that only restates its file name: "wheat divider" |
| handwritten/01-bakery-images.html | f_0005 (line 36) | image-alt | 1 | rejected_suspicious | text alternative "hours table" only restates the file name "hours-table.png"; accessibility tree: <img> (line 36) has a name that only restates its file name: "hours table"; visual (desktop): 0.31% of the page changed ou |
| handwritten/01-bakery-images.html | f_0006 (line 39) | image-alt | 1 | rejected_suspicious | text alternative "map pin" only restates the file name "map-pin.png"; accessibility tree: <img> (line 39) has a name that only restates its file name: "map pin"; visual (desktop): 0.19% of the page changed outside the pa |
| handwritten/01-bakery-images.html | f_0007 (line 43) | image-alt | 1 | rejected_suspicious | text alternative "social icon" only restates the file name "social-icon.png"; accessibility tree: <img> (line 43) has a name that only restates its file name: "social icon" |
| handwritten/02-newsletter-labels.html | f_0002 (line 33) | label | 1 | rejected_suspicious | aria-label "weekly" only restates the name attribute "weekly" and does not contain the visible text next to the <input> |
| handwritten/02-newsletter-labels.html | f_0003 (line 37) | label | 1 | rejected_suspicious | aria-label "topics" only restates the name attribute "topics" and does not contain the visible text next to the <textarea> |
| handwritten/02-newsletter-labels.html | f_0004 (line 42) | label | 1 | rejected_suspicious | generic aria-label: "q"; aria-label "q" only restates the name attribute "q" and does not contain the visible text next to the <input> |
| handwritten/04-dashboard-roles.html | f_0002 (line 23) | aria-roles | 1 | rejected_suspicious | left a focusable element without a role (role removed instead of corrected) |
| handwritten/04-dashboard-roles.html | f_0006 (line 33) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| handwritten/05-settings-aria-values.html | f_0001 (line 15) | aria-valid-attr-value | 1 | rejected_suspicious | accessibility tree: <button> (line 15) lost its expanded state |
| handwritten/05-settings-aria-values.html | f_0003 (line 23) | aria-valid-attr-value | 1 | rejected_suspicious | accessibility tree: <button> (line 23) lost its pressed state |
| handwritten/07-recipe-mixed.html | f_0002 (line 17) | image-alt | 1 | rejected_suspicious | text alternative "lentil soup bowl" only restates the file name "lentil-soup-bowl.jpg"; accessibility tree: <img> (line 17) has a name that only restates its file name: "lentil soup bowl"; visual (desktop): 1.25% of the  |
| handwritten/08-portfolio-ambiguous.html | f_0001 (line 15) | image-alt | 1 | rejected_suspicious | text alternative "a" only restates the file name "a.png"; accessibility tree: <img> (line 15) has a name that only restates its file name: "a" |
| handwritten/08-portfolio-ambiguous.html | f_0002 (line 17) | image-alt | 1 | rejected_suspicious | text alternative "ic share 24" only restates the file name "ic_share_24.svg"; accessibility tree: <img> (line 17) has a name that only restates its file name: "ic share 24" |
| handwritten/08-portfolio-ambiguous.html | f_0003 (line 18) | image-alt | 1 | rejected_suspicious | text alternative "ic heart 24" only restates the file name "ic_heart_24.svg"; accessibility tree: <img> (line 18) has a name that only restates its file name: "ic heart 24"; visual (desktop): 0.24% of the page changed ou |
| handwritten/08-portfolio-ambiguous.html | f_0004 (line 24) | image-alt | 1 | rejected_suspicious | generic alt: "img 2041"; text alternative "img 2041" only restates the file name "IMG_2041.jpg"; accessibility tree: <img> (line 24) now has a generic name "img 2041" |
| handwritten/08-portfolio-ambiguous.html | f_0005 (line 25) | image-alt | 1 | rejected_suspicious | generic alt: "img 2057"; text alternative "img 2057" only restates the file name "IMG_2057.jpg"; accessibility tree: <img> (line 25) now has a generic name "img 2057" |
| handwritten/08-portfolio-ambiguous.html | f_0006 (line 26) | image-alt | 1 | rejected_suspicious | text alternative "final v3 final" only restates the file name "final-v3-FINAL.png"; accessibility tree: <img> (line 26) has a name that only restates its file name: "final v3 final" |
| handwritten/08-portfolio-ambiguous.html | f_0007 (line 30) | image-alt | 1 | rejected_suspicious | text alternative "logo1" only restates the file name "logo1.png"; accessibility tree: <img> (line 30) has a name that only restates its file name: "logo1" |
| handwritten/08-portfolio-ambiguous.html | f_0008 (line 31) | image-alt | 1 | rejected_suspicious | text alternative "logo2" only restates the file name "logo2.png"; accessibility tree: <img> (line 31) has a name that only restates its file name: "logo2" |
| handwritten/08-portfolio-ambiguous.html | f_0009 (line 34) | image-alt | 1 | rejected_suspicious | text alternative "email address" only restates the file name "email-address.png"; accessibility tree: <img> (line 34) has a name that only restates its file name: "email address" |
| handwritten/08-portfolio-ambiguous.html | f_0010 (line 35) | image-alt | 1 | rejected_suspicious | generic alt: "spacer"; text alternative "spacer" only restates the file name "spacer.gif"; accessibility tree: <img> (line 35) now has a generic name "spacer" |
| handwritten/09-event-signup.html | f_0002 (line 23) | label | 1 | rejected_suspicious | aria-label "first" only restates the name attribute "first" and does not contain the visible text next to the <input> |
| handwritten/09-event-signup.html | f_0003 (line 23) | label | 1 | rejected_suspicious | aria-label "last" only restates the name attribute "last" and does not contain the visible text next to the <input> |
| handwritten/09-event-signup.html | f_0005 (line 31) | label | 1 | rejected_suspicious | aria-label "org" only restates the name attribute "org" and does not contain the visible text next to the <input> |
| handwritten/10-coworking-crlf.html | f_0002 (line 18) | image-alt | 1 | rejected_suspicious | text alternative "desk" only restates the file name "desk.jpg"; accessibility tree: <img> (line 18) has a name that only restates its file name: "desk" |
| handwritten/10-coworking-crlf.html | f_0004 (line 20) | label | 1 | rejected_suspicious | aria-label "days" only restates the name attribute "days" and does not contain the visible text next to the <input> |
| handwritten/10-coworking-crlf.html | f_0005 (line 24) | image-alt | 1 | rejected_suspicious | text alternative "desk" only restates the file name "desk.jpg"; accessibility tree: <img> (line 24) has a name that only restates its file name: "desk" |
| handwritten/10-coworking-crlf.html | f_0007 (line 26) | label | 1 | rejected_suspicious | aria-label "days" only restates the name attribute "days" and does not contain the visible text next to the <input> |
| handwritten/10-coworking-crlf.html | f_0008 (line 30) | image-alt | 1 | rejected_suspicious | text alternative "meeting room" only restates the file name "meeting-room.jpg"; accessibility tree: <img> (line 30) has a name that only restates its file name: "meeting room" |

## Rejections

| Page | Finding | Rule | Tier | Status | Reason |
|---|---|---|---|---|---|
| eval/axe-core/aria-allowed-attr-failures.html | f_0014 (line 30) | aria-allowed-attr | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| eval/axe-core/aria-allowed-attr-failures.html | f_0015 (line 31) | aria-allowed-attr | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| eval/axe-core/aria-allowed-attr-failures.html | f_0017 (line 38) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 38 |
| eval/axe-core/aria-allowed-attr-failures.html | f_0018 (line 39) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 39 |
| eval/axe-core/aria-allowed-attr-failures.html | f_0021 (line 42) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 42 |
| eval/axe-core/color-contrast-text-shadows.html | f_0093 (line 1009) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0094 (line 1010) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0095 (line 1011) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0096 (line 1015) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0097 (line 1016) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0098 (line 1017) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0099 (line 1021) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0100 (line 1022) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/axe-core/color-contrast-text-shadows.html | f_0101 (line 1023) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/bootstrap-examples/list-groups/index.html | f_0001 (line 398) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/bootstrap-examples/list-groups/index.html | f_0002 (line 399) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/bootstrap-examples/modals/index.html | f_0002 (line 322) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 336 |
| eval/bootstrap-examples/offcanvas-navbar/index.html | f_0002 (line 291) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 358 |
| eval/bootstrap-examples/pricing/index.html | f_0004 (line 525) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 560 |
| eval/bootstrap-examples/product/index.html | f_0002 (line 447) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 482 |
| eval/startbootstrap/agency/index.html | f_0002 (line 87) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/agency/index.html | f_0003 (line 250) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/agency/index.html | f_0004 (line 257) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/agency/index.html | f_0005 (line 267) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/agency/index.html | f_0006 (line 277) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/agency/index.html | f_0007 (line 285) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/clean-blog/contact.html | f_0001 (line 105) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/creative/index.html | f_0002 (line 59) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/creative/index.html | f_0003 (line 233) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/creative/index.html | f_0004 (line 247) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/freelancer/index.html | f_0003 (line 128) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/freelancer/index.html | f_0007 (line 214) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/grayscale/index.html | f_0003 (line 73) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/grayscale/index.html | f_0005 (line 161) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/grayscale/index.html | f_0007 (line 181) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/landing-page/index.html | f_0002 (line 136) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 143 |
| eval/startbootstrap/landing-page/index.html | f_0007 (line 216) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/about.html | f_0001 (line 69) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/about.html | f_0002 (line 91) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/about.html | f_0003 (line 97) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 104 |
| eval/startbootstrap/modern-business/about.html | f_0004 (line 98) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/about.html | f_0005 (line 105) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/about.html | f_0006 (line 112) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/about.html | f_0007 (line 119) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/blog-home.html | f_0001 (line 79) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/blog-home.html | f_0002 (line 84) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/blog-home.html | f_0003 (line 89) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/blog-post.html | f_0001 (line 71) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/blog-post.html | f_0002 (line 72) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/contact.html | f_0001 (line 56) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/contact.html | f_0002 (line 111) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/faq.html | f_0001 (line 138) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/modern-business/index.html | f_0001 (line 135) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 156 |
| eval/startbootstrap/modern-business/pricing.html | f_0001 (line 53) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/new-age/index.html | f_0001 (line 51) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/new-age/index.html | f_0003 (line 181) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/resume/index.html | f_0007 (line 70) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/resume/index.html | f_0008 (line 78) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/resume/index.html | f_0009 (line 86) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/resume/index.html | f_0010 (line 94) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/resume/index.html | f_0011 (line 110) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/resume/index.html | f_0012 (line 118) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0004 (line 327) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0006 (line 375) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0007 (line 393) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0008 (line 411) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0009 (line 440) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0012 (line 471) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0013 (line 471) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 489 |
| eval/startbootstrap/sb-admin-2/cards.html | f_0015 (line 489) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/cards.html | f_0017 (line 518) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0003 (line 333) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0006 (line 384) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0007 (line 402) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0008 (line 420) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0009 (line 449) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0010 (line 472) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0011 (line 472) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 503 |
| eval/startbootstrap/sb-admin-2/index.html | f_0012 (line 503) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0016 (line 549) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0028 (line 591) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0030 (line 599) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0032 (line 607) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0034 (line 615) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0036 (line 623) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0038 (line 631) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0040 (line 639) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0041 (line 647) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0042 (line 660) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/index.html | f_0047 (line 679) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/login.html | f_0003 (line 65) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/register.html | f_0002 (line 68) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/tables.html | f_0002 (line 331) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin-2/tables.html | f_0006 (line 375) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/charts.html | f_0006 (line 130) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/charts.html | f_0007 (line 140) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/charts.html | f_0008 (line 150) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/charts.html | f_0009 (line 159) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/index.html | f_0007 (line 131) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/index.html | f_0008 (line 668) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/login.html | f_0002 (line 55) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/register.html | f_0002 (line 74) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/sb-admin/tables.html | f_0006 (line 618) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| eval/startbootstrap/shop-homepage/index.html | f_0001 (line 67) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 88 |
| external/axe-core/aria-allowed-attr.html | f_0014 (line 30) | aria-allowed-attr | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-allowed-attr.html | f_0015 (line 31) | aria-allowed-attr | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-allowed-attr.html | f_0017 (line 38) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 38 |
| external/axe-core/aria-allowed-attr.html | f_0018 (line 39) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 39 |
| external/axe-core/aria-allowed-attr.html | f_0021 (line 42) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 42 |
| external/axe-core/aria-required-attr.html | f_0001 (line 14) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 14 |
| external/axe-core/aria-required-attr.html | f_0002 (line 25) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 25 |
| external/axe-core/aria-required-attr.html | f_0004 (line 44) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 44 |
| external/axe-core/aria-required-attr.html | f_0009 (line 67) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 67 |
| external/axe-core/aria-required-attr.html | f_0013 (line 82) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 82 |
| external/axe-core/aria-roles.html | f_0003 (line 34) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 34 |
| external/axe-core/aria-valid-attr-value.html | f_0050 (line 51) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0065 (line 68) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0067 (line 78) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0069 (line 88) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0071 (line 98) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0073 (line 109) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0075 (line 121) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| external/axe-core/aria-valid-attr-value.html | f_0187 (line 413) | aria-required-attr | 1 | rejected_persists | aria-required-attr is still reported on the target node |
| external/axe-core/color-contrast.html | f_0001 (line 41) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0002 (line 68) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0003 (line 71) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0004 (line 76) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0005 (line 81) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0012 (line 365) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0013 (line 368) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0016 (line 469) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0018 (line 527) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0019 (line 540) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/color-contrast.html | f_0021 (line 590) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| external/axe-core/heading-order.html | f_0002 (line 24) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 24 |
| external/axe-core/heading-order.html | f_0003 (line 27) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 27 |
| handwritten/01-bakery-images.html | f_0001 (line 15) | image-alt | 1 | rejected_regression | introduced 2 new violation(s): target-size at line 15, target-size at line 18 |
| handwritten/05-settings-aria-values.html | f_0002 (line 20) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 20 |
| handwritten/06-pricing-contrast.html | f_0005 (line 34) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| handwritten/07-recipe-mixed.html | f_0003 (line 18) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 24 |

## Verifier checks

Every applied patch is compared with the original page: axe-core with the full WCAG 2.x A/AA rule set, static suspicion checks on the patched source, and:

- accessibility tree (computed role, name, states, focusability of every element): on
- focus order (Tab sequence): on
- visual (full-page screenshots): desktop 1280x900; limit 0.10% of pixels changed outside the patched elements; layout shifts measured, not enforced

| | Patches |
|---|---:|
| Compared beyond axe | 1389 |
| Rejected by the accessibility-tree comparison | 169 |
| Rejected by the focus-order comparison | 0 |
| Rejected by the visual comparison | 8 |
| Moved other elements on the page (layout shift, reported only) | 69 |

Largest pixel change outside the patched elements on a page without layout shift: 1.248%.

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

This run replaces tier 0 and tier 1 with [`naive-fixer.mjs`](../naive-fixer.mjs): the quick fixes a tool would ship if
it never checked its own work (alt text from the file name, `aria-label` from the `name` attribute, remove whatever
attribute or role axe complains about, add missing state with a default, inline black or white text). It is a
strawman by construction. It exists to measure the verifier, not to rate fixers, and every patch it wrote is in this
directory.

**Eval first, and why it looks better than dev.** On the 73 held-out eval pages the naive fixer gets 619 of 736
patches verified (84.1% [81.3–86.6]), against 403 of 653 on dev. That is not the fixer doing better. 587 of the 619
are `color-contrast` patches, the inline `style="color: ..."` override described below that a reviewer would reject,
and `color-contrast` is 677 of the 738 eval violations; three pages hold 547 of the 738. The eval pages have only 6
`image-alt` and 2 `label` violations, the rules where the source checks reject most naive patches on dev, so the
verifier rejects less: 117 of 736 (15.9% [13.4–18.7]), of which axe alone would have shipped 15, axe plus source checks 4.
The intervals assume independent findings, and hundreds of contrast findings produced by one stylesheet are not,
so they are narrower than they should be. Everything below is about the 22 dev pages.

**What the verifier catches.** Of the 653 patches that applied, the full verifier rejected 250 (38.3%). A pipeline
that shipped everything would have called all 250 fixed; one that only re-ran axe would still have shipped 223 of
them. Most of those are the 159 `image-alt` patches whose alt text only restates the file name
(`plot-map.png` → `alt="plot map"`) and the 53 `label` patches whose `aria-label` only restates the field's `name` or
`id` (`aria-label="fail1"`, `aria-label="org"`), which axe accepts and the source checks reject. Seven
`aria-controls="false"` (an id reference to no element), removed focusable roles, and 14 patches that broke something
else on the page (new violations) make up the rest.

**What each layer adds, on the dev pages.** Axe alone removes 27 patches (regressions and violations still present).
The source checks remove 219 more. The browser checks (accessibility tree, focus order, pixels) remove only 4 that
the source checks had not already flagged: the accessibility-tree comparison fires on 162 patches, but 158 of them
are the same file-name alt texts. On these pages, the browser layers are a second opinion more than a new signal.
That may change with tier-1 patches from a real model, which fail in less predictable ways; it has not been measured
yet.

**What the verifier does not catch.** 403 naive patches verified, which is more than tier 0 (136) and a fix rate of
60.9% against tier 0's 20.5%. That number is not a success. "Verified" means axe no longer reports the violation,
nothing else got worse, and no suspicion check fired. A reviewer would reject many of these:

| Rule | Verified | What the naive patch does | Why a person would reject it |
|---|---:|---|---|
| color-contrast | 169 | `style="color: #000000"` on the element | Passes the contrast check and ignores the design system: one inline override per element instead of a token change |
| aria-allowed-attr | 145 | removes the attribute | Same as tier 0 for most of them; for state attributes (`aria-checked` on a `<button>`) it throws the author's intent away, which is why tier 0 declines those |
| label | 2 | `aria-label` from the `name` (`aria-label="fullname"` next to the visible text "Full name") | The name agrees with what sighted users read, so the verifier accepts it; a reviewer would still associate the visible text with a `<label>`, as tier 0 does |
| aria-valid-attr-value | 43 | removes the attribute | `aria-live="loud"` → no live region at all: the announcement is lost, not fixed |
| aria-required-attr | 22 | adds the state with a default (`aria-checked="false"` ×14, `aria-valuenow="0"` ×7, `aria-expanded="false"` ×1) | Invents widget state the markup does not give; tier 0 declines exactly this |
| aria-roles | 16 | removes the role | `role="navigaton"` becomes no landmark instead of `role="navigation"` |
| heading-order | 6 | re-levels the one flagged heading | Passes when the siblings happen not to break; tier 0 moves them together |

None of these make the page worse for assistive technology than it was, which is what the verifier checks. Several
do not make it better either, and some (a default state) state something that may be false. These are known gaps,
not bugs to hide: a verifier can prove "nothing got worse", it cannot prove "this is what the author meant".

The first version of this analysis named two gaps that looked closable without human judgment. Both are now
suspicion checks ([ADR 0015](../../../docs/adr/0015-identifier-labels-and-dangling-id-references.md)), and this run
measures them: an `aria-label` that only restates the element's `name` or `id` moved 49 `label` patches from
verified to suspicious (51 → 2), and an id reference that points at no element moved the 7 `aria-controls="false"`
patches (`aria-required-attr`, 29 → 22). The two `label` patches still verified sit next to visible text that says the
same thing ("Full name", "Email"), which ADR 0015 accepts on purpose. Neither check flagged a tier-0 patch. The rest
of the table needs a person, which is why suspicious and verified patches both go through review before merge.

**What this means for the other numbers.** Precision against the verifier is an upper bound on precision against a
human reviewer, for every generator. Tier 0's 100% holds because its codemods decline the cases above, not because
the verifier would have caught them. A tier-1 model's precision needs a human-reviewed sample next to it before it
means much.
