# a11yfix benchmark report

- Mode: `llm` (cmd:node bench/baselines/naive-fixer.mjs)
- Corpus: `./corpus` (22 pages)
- Engines: a11yfix-core 0.3.0, axe-core 4.14.1, playwright 1.65.1, node 26.13.1
- Run 2026-11-20, total wall time 243.8 s

> a11yfix does not guarantee WCAG conformance. "Verified" means axe-core no longer reports the violation and nothing else broke; it is not a human review.

## Summary

| Metric | Value |
|---|---|
| Pages | 22 |
| Violations detected | 662 |
| Skipped (needs judgment, no model in this run) | 0 |
| Patches proposed | 653 |
| Patches verified | 403 |
| **Fix rate** (verified / detected) | **60.9%** |
| **Precision** (verified / proposed) | **61.7%** |
| False-fix rate (suspicious / (verified + suspicious)) | 35.6% |
| Regression rate (regressions / applied) | 2.1% |
| Mean cost per verified fix | 0 tokens |
| Total tokens | 0 |
| Mean time per page | 20.9 s |
| Subset violations left after applying the output patch | 43 of 662 |
| WCAG A/AA violations (all rules) before → after | 809 → 171 |

## By tier

Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.

| Tier | Proposed | Verified | Precision [95% CI] | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |
|---|---|---|---|---|---|---|---|---|
| 0 (codemod) | 0 | 0 | **n/a** | 0 | 0 | 0 | 0 | n/a |
| 1 (model) | 653 | 403 | **61.7% [57.9–65.4], n=653** | 223 | 14 | 13 | 0 | 0 |

## Compared with `codemods only` (2026-11-20)

| Metric | This run | codemods only |
|---|---|---|
| Fix rate | 60.9% | 20.5% |
| Precision | 61.7% | 100.0% |
| False-fix rate | 35.6% | 0.0% |
| Regression rate | 2.1% | 0.0% |

## What the verifier adds

Every patch that applied cleanly, judged by weaker verifiers. "Shipped but rejected by the full verifier" counts patches a pipeline with that verifier would have put in the output and called fixed. The full verifier is the reference here, not ground truth: a patch it accepts can still be wrong in ways no automatic check sees.

| Tier | Verifier | Would ship | Shipped but rejected by the full verifier | Share of shipped |
|---|---|---:|---:|---|
| 1 (model) | none (shape validation only) | 653 | 250 | 38.3% [34.6–42.1], n=653 |
| 1 (model) | axe only | 626 | 223 | 35.6% [32–39.5], n=626 |
| 1 (model) | axe + source checks | 407 | 4 | 1.0% [0.4–2.5], n=407 |
| 1 (model) | full (+ accessibility tree, focus order, pixels) | 403 | 0 | 0.0% [0–0.9], n=403 |

## Outcomes

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

## By rule

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

| Page | Detected | Verified | Left after patch | WCAG A/AA before → after | Time |
|---|---|---|---|---|---|
| external/axe-core/aria-allowed-attr.html | 23 | 14 | 9 | 33 → 19 | 7.8 s |
| external/axe-core/aria-required-attr.html | 16 | 7 | 6 | 24 → 14 | 6.6 s |
| external/axe-core/aria-roles.html | 22 | 20 | 1 | 60 → 39 | 7.7 s |
| external/axe-core/aria-valid-attr-value.html | 189 | 170 | 8 | 198 → 17 | 87.5 s |
| external/axe-core/color-contrast.html | 22 | 3 | 11 | 28 → 17 | 87.5 s |
| external/axe-core/heading-order.html | 3 | 1 | 2 | 3 → 2 | 3.8 s |
| external/axe-core/image-alt.html | 19 | 3 | 1 | 22 → 4 | 5.8 s |
| external/axe-core/label.html | 14 | 0 | 0 | 28 → 14 | 8.4 s |
| external/w3c-bad/home.html | 71 | 38 | 0 | 84 → 9 | 32.0 s |
| external/w3c-bad/news.html | 75 | 36 | 0 | 86 → 7 | 58.6 s |
| external/w3c-bad/survey.html | 71 | 36 | 0 | 83 → 8 | 49.9 s |
| external/w3c-bad/tickets.html | 70 | 44 | 0 | 81 → 7 | 49.0 s |
| handwritten/01-bakery-images.html | 7 | 0 | 1 | 10 → 3 | 23.3 s |
| handwritten/02-newsletter-labels.html | 4 | 1 | 0 | 5 → 1 | 2.2 s |
| handwritten/03-docs-headings.html | 2 | 2 | 0 | 4 → 2 | 2.1 s |
| handwritten/04-dashboard-roles.html | 7 | 5 | 0 | 7 → 0 | 3.1 s |
| handwritten/05-settings-aria-values.html | 7 | 4 | 1 | 9 → 3 | 3.0 s |
| handwritten/06-pricing-contrast.html | 7 | 6 | 1 | 7 → 1 | 3.2 s |
| handwritten/07-recipe-mixed.html | 7 | 5 | 1 | 8 → 2 | 2.9 s |
| handwritten/08-portfolio-ambiguous.html | 10 | 0 | 0 | 12 → 0 | 4.7 s |
| handwritten/09-event-signup.html | 7 | 4 | 1 | 8 → 2 | 5.2 s |
| handwritten/10-coworking-crlf.html | 9 | 4 | 0 | 9 → 0 | 4.6 s |

## Suspicious patches

These passed axe but tripped a suspicion check: they may silence the rule instead of fixing the problem. They are included in the output patch, marked, unless `--strict` is set. Review them first.

| Page | Finding | Rule | Tier | Status | Why |
|---|---|---|---|---|---|
| aria-allowed-attr.html | f_0009 (line 26) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| aria-allowed-attr.html | f_0011 (line 27) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| aria-allowed-attr.html | f_0013 (line 28) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| aria-allowed-attr.html | f_0019 (line 40) | aria-allowed-attr | 1 | rejected_suspicious | accessibility tree: <button> (line 40) lost its pressed state |
| aria-required-attr.html | f_0005 (line 52) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| aria-required-attr.html | f_0007 (line 63) | label | 1 | rejected_suspicious | aria-label "pass9" only restates the id attribute "pass9" and does not contain the visible text next to the <input> |
| aria-required-attr.html | f_0008 (line 64) | label | 1 | rejected_suspicious | aria-label "pass10" only restates the id attribute "pass10" and does not contain the visible text next to the <input> |
| aria-required-attr.html | f_0014 (line 83) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| aria-roles.html | f_0002 (line 23) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| aria-valid-attr-value.html | f_0012 (line 27) | aria-valid-attr-value | 1 | rejected_suspicious | accessibility tree: <div> (line 27) lost its disabled state |
| aria-valid-attr-value.html | f_0066 (line 68) | label | 1 | rejected_suspicious | aria-label "violation43" only restates the id attribute "violation43" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0068 (line 78) | label | 1 | rejected_suspicious | aria-label "violation44" only restates the id attribute "violation44" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0070 (line 88) | label | 1 | rejected_suspicious | aria-label "violation45" only restates the id attribute "violation45" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0072 (line 98) | label | 1 | rejected_suspicious | aria-label "violation46" only restates the id attribute "violation46" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0074 (line 109) | label | 1 | rejected_suspicious | aria-label "violation47" only restates the id attribute "violation47" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0076 (line 121) | label | 1 | rejected_suspicious | aria-label "violation48" only restates the id attribute "violation48" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0180 (line 359) | label | 1 | rejected_suspicious | aria-label "pass187" only restates the id attribute "pass187" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0181 (line 370) | label | 1 | rejected_suspicious | aria-label "pass189" only restates the id attribute "pass189" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0182 (line 379) | label | 1 | rejected_suspicious | aria-label "pass190" only restates the id attribute "pass190" and does not contain the visible text next to the <input> |
| aria-valid-attr-value.html | f_0184 (line 394) | label | 1 | rejected_suspicious | aria-label "pass192" only restates the id attribute "pass192" and does not contain the visible text next to the <input> |
| color-contrast.html | f_0006 (line 95) | label | 1 | rejected_suspicious | aria-label "ignore1" only restates the id attribute "ignore1" and does not contain the visible text next to the <input> |
| color-contrast.html | f_0007 (line 101) | label | 1 | rejected_suspicious | aria-label "ignore2" only restates the id attribute "ignore2" and does not contain the visible text next to the <input> |
| color-contrast.html | f_0008 (line 211) | label | 1 | rejected_suspicious | aria-label "canttell6" only restates the id attribute "canttell6" and does not contain the visible text next to the <input> |
| color-contrast.html | f_0009 (line 238) | label | 1 | rejected_suspicious | aria-label "canttell11" only restates the id attribute "canttell11" and does not contain the visible text next to the <textarea> |
| color-contrast.html | f_0010 (line 257) | label | 1 | rejected_suspicious | aria-label "canttell15" only restates the id attribute "canttell15" and does not contain the visible text next to the <input> |
| color-contrast.html | f_0017 (line 521) | label | 1 | rejected_suspicious | aria-label "pass24" only restates the id attribute "pass24" and does not contain the visible text next to the <textarea> |
| color-contrast.html | f_0020 (line 567) | label | 1 | rejected_suspicious | aria-label "canttell24" only restates the id attribute "canttell24" and does not contain the visible text next to the <input> |
| color-contrast.html | f_0022 (line 590) | label | 1 | rejected_suspicious | aria-label "fail15" only restates the id attribute "fail15" and does not contain the visible text next to the <input> |
| image-alt.html | f_0001 (line 16) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 16) now has a generic name "img" |
| image-alt.html | f_0002 (line 17) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 17) now has a generic name "img" |
| image-alt.html | f_0003 (line 18) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 18) now has a generic name "img" |
| image-alt.html | f_0004 (line 19) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 19) now has a generic name "img" |
| image-alt.html | f_0005 (line 24) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 24) now has a generic name "img" |
| image-alt.html | f_0006 (line 29) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 29) now has a generic name "img" |
| image-alt.html | f_0007 (line 31) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 31) now has a generic name "img" |
| image-alt.html | f_0008 (line 32) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 32) now has a generic name "img" |
| image-alt.html | f_0009 (line 33) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 33) now has a generic name "img" |
| image-alt.html | f_0010 (line 34) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 34) now has a generic name "img" |
| image-alt.html | f_0011 (line 36) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 36) now has a generic name "img" |
| image-alt.html | f_0013 (line 37) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 37) now has a generic name "img" |
| image-alt.html | f_0016 (line 46) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 46) now has a generic name "img" |
| image-alt.html | f_0017 (line 47) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 47) now has a generic name "img" |
| image-alt.html | f_0018 (line 48) | image-alt | 1 | rejected_suspicious | generic alt: "img"; text alternative "img" only restates the file name "img.jpg"; accessibility tree: <img> (line 48) now has a generic name "img" |
| image-alt.html | f_0019 (line 50) | image-alt | 1 | rejected_suspicious | generic alt: "image"; accessibility tree: <img> (line 50) now has a generic name "image" |
| label.html | f_0001 (line 20) | label | 1 | rejected_suspicious | aria-label "fail1" only restates the id attribute "fail1" and does not contain the visible text next to the <input> |
| label.html | f_0002 (line 21) | label | 1 | rejected_suspicious | aria-label "fail2" only restates the id attribute "fail2" and does not contain the visible text next to the <textarea> |
| label.html | f_0003 (line 30) | label | 1 | rejected_suspicious | aria-label "fail3" only restates the id attribute "fail3" and does not contain the visible text next to the <input> |
| label.html | f_0004 (line 31) | label | 1 | rejected_suspicious | aria-label "fail4" only restates the id attribute "fail4" and does not contain the visible text next to the <textarea> |
| label.html | f_0005 (line 32) | label | 1 | rejected_suspicious | aria-label "fail5" only restates the id attribute "fail5" and does not contain the visible text next to the <input> |
| label.html | f_0006 (line 33) | label | 1 | rejected_suspicious | aria-label "fail6" only restates the id attribute "fail6" and does not contain the visible text next to the <textarea> |
| label.html | f_0007 (line 36) | label | 1 | rejected_suspicious | aria-label "fail7" only restates the id attribute "fail7" and does not contain the visible text next to the <input> |
| label.html | f_0008 (line 44) | label | 1 | rejected_suspicious | aria-label "fail8" only restates the id attribute "fail8" and does not contain the visible text next to the <input> |
| label.html | f_0009 (line 76) | label | 1 | rejected_suspicious | aria-label "fail9" only restates the id attribute "fail9" and does not contain the visible text next to the <input> |
| label.html | f_0010 (line 77) | label | 1 | rejected_suspicious | aria-label "fail10" only restates the id attribute "fail10" and does not contain the visible text next to the <input> |
| label.html | f_0011 (line 79) | label | 1 | rejected_suspicious | aria-label "fail11" only restates the id attribute "fail11" and does not contain the visible text next to the <input> |
| label.html | f_0012 (line 81) | label | 1 | rejected_suspicious | aria-label "fail12" only restates the id attribute "fail12" and does not contain the visible text next to the <textarea> |
| label.html | f_0013 (line 93) | label | 1 | rejected_suspicious | aria-label "fail13" only restates the id attribute "fail13" and does not contain the visible text next to the <input> |
| label.html | f_0014 (line 101) | label | 1 | rejected_suspicious | aria-label "fail14" only restates the id attribute "fail14" and does not contain the visible text next to the <input> |
| home.html | f_0014 (line 178) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 178) has a name that only restates its file name: "border left top" |
| home.html | f_0015 (line 179) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 179) has a name that only restates its file name: "border top" |
| home.html | f_0016 (line 180) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 180) has a name that only restates its file name: "border right top" |
| home.html | f_0017 (line 183) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 183) has a name that only restates its file name: "border left" |
| home.html | f_0018 (line 188) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 188) has a name that only restates its file name: "top logo next end" |
| home.html | f_0019 (line 189) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 189) has a name that only restates its file name: "top weather" |
| home.html | f_0020 (line 190) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 190) has a name that only restates its file name: "top logo next start" |
| home.html | f_0021 (line 213) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 213) has a name that only restates its file name: "mark" |
| home.html | f_0022 (line 238) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 238) has a name that only restates its file name: "marker2 w" |
| home.html | f_0023 (line 249) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 249) has a name that only restates its file name: "marker2 w" |
| home.html | f_0024 (line 250) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 250) has a name that only restates its file name: "marker2 t" |
| home.html | f_0025 (line 253) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 253) has a name that only restates its file name: "nav home" |
| home.html | f_0026 (line 256) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 256) has a name that only restates its file name: "marker2 w" |
| home.html | f_0027 (line 259) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 259) has a name that only restates its file name: "nav news" |
| home.html | f_0028 (line 262) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 262) has a name that only restates its file name: "marker2 w" |
| home.html | f_0029 (line 265) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 265) has a name that only restates its file name: "nav facts" |
| home.html | f_0030 (line 268) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 268) has a name that only restates its file name: "marker2 w" |
| home.html | f_0031 (line 271) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 271) has a name that only restates its file name: "nav survey" |
| home.html | f_0032 (line 274) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 274) has a name that only restates its file name: "marker2 w" |
| home.html | f_0033 (line 278) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 278) has a name that only restates its file name: "blank 5x5" |
| home.html | f_0034 (line 285) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 285) has a name that only restates its file name: "headline middle" |
| home.html | f_0035 (line 286) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 286) has a name that only restates its file name: "headline middle" |
| home.html | f_0036 (line 287) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 287) has a name that only restates its file name: "headline middle" |
| home.html | f_0037 (line 306) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 306) has a name that only restates its file name: "blank 5x5" |
| home.html | f_0038 (line 310) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 310) has a name that only restates its file name: "marker2 t" |
| home.html | f_0039 (line 311) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 311) has a name that only restates its file name: "marker2 w" |
| home.html | f_0041 (line 317) | image-alt | 1 | rejected_suspicious | text alternative "teaser right1" only restates the file name "teaser_right1.jpg"; accessibility tree: <img> (line 317) has a name that only restates its file name: "teaser right1" |
| home.html | f_0042 (line 332) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 332) has a name that only restates its file name: "marker2 w" |
| home.html | f_0044 (line 338) | image-alt | 1 | rejected_suspicious | text alternative "teaser right2" only restates the file name "teaser_right2.jpg"; accessibility tree: <img> (line 338) has a name that only restates its file name: "teaser right2" |
| home.html | f_0045 (line 359) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 359) has a name that only restates its file name: "border right" |
| home.html | f_0046 (line 362) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 362) has a name that only restates its file name: "border bottom left" |
| home.html | f_0047 (line 363) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 363) has a name that only restates its file name: "border bottom" |
| home.html | f_0048 (line 364) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 364) has a name that only restates its file name: "border bottom right" |
| news.html | f_0014 (line 80) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 80) has a name that only restates its file name: "border left top" |
| news.html | f_0015 (line 81) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 81) has a name that only restates its file name: "border top" |
| news.html | f_0016 (line 82) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 82) has a name that only restates its file name: "border right top" |
| news.html | f_0017 (line 85) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 85) has a name that only restates its file name: "border left" |
| news.html | f_0018 (line 90) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 90) has a name that only restates its file name: "top logo next end" |
| news.html | f_0019 (line 91) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 91) has a name that only restates its file name: "top weather" |
| news.html | f_0020 (line 92) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 92) has a name that only restates its file name: "top logo next start" |
| news.html | f_0021 (line 115) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 115) has a name that only restates its file name: "mark" |
| news.html | f_0022 (line 140) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 140) has a name that only restates its file name: "marker2 w" |
| news.html | f_0023 (line 151) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 151) has a name that only restates its file name: "marker2 w" |
| news.html | f_0024 (line 152) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 152) has a name that only restates its file name: "marker2 t" |
| news.html | f_0025 (line 155) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 155) has a name that only restates its file name: "nav home" |
| news.html | f_0026 (line 158) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 158) has a name that only restates its file name: "marker2 w" |
| news.html | f_0027 (line 161) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 161) has a name that only restates its file name: "nav news" |
| news.html | f_0028 (line 164) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 164) has a name that only restates its file name: "marker2 w" |
| news.html | f_0029 (line 167) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 167) has a name that only restates its file name: "nav facts" |
| news.html | f_0030 (line 170) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 170) has a name that only restates its file name: "marker2 w" |
| news.html | f_0031 (line 173) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 173) has a name that only restates its file name: "nav survey" |
| news.html | f_0032 (line 176) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 176) has a name that only restates its file name: "marker2 w" |
| news.html | f_0033 (line 180) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 180) has a name that only restates its file name: "blank 5x5" |
| news.html | f_0034 (line 197) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 197) has a name that only restates its file name: "marker2 t" |
| news.html | f_0035 (line 198) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 198) has a name that only restates its file name: "marker2 w" |
| news.html | f_0036 (line 201) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 201) has a name that only restates its file name: "headline middle" |
| news.html | f_0037 (line 202) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 202) has a name that only restates its file name: "marker2 t" |
| news.html | f_0038 (line 207) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 207) has a name that only restates its file name: "marker2 w" |
| news.html | f_0039 (line 218) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 218) has a name that only restates its file name: "marker2 t" |
| news.html | f_0040 (line 219) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 219) has a name that only restates its file name: "marker2 w" |
| news.html | f_0041 (line 220) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 220) has a name that only restates its file name: "marker2 t" |
| news.html | f_0042 (line 223) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 223) has a name that only restates its file name: "headline middle" |
| news.html | f_0043 (line 228) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 228) has a name that only restates its file name: "marker2 w" |
| news.html | f_0044 (line 241) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 241) has a name that only restates its file name: "marker2 t" |
| news.html | f_0045 (line 242) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 242) has a name that only restates its file name: "marker2 w" |
| news.html | f_0046 (line 243) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 243) has a name that only restates its file name: "marker2 t" |
| news.html | f_0047 (line 246) | image-alt | 1 | rejected_suspicious | text alternative "headline middle" only restates the file name "headline_middle.gif"; accessibility tree: <img> (line 246) has a name that only restates its file name: "headline middle" |
| news.html | f_0048 (line 251) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 251) has a name that only restates its file name: "marker2 w" |
| news.html | f_0049 (line 268) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 268) has a name that only restates its file name: "border right" |
| news.html | f_0050 (line 271) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 271) has a name that only restates its file name: "border bottom left" |
| news.html | f_0051 (line 272) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 272) has a name that only restates its file name: "border bottom" |
| news.html | f_0052 (line 273) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 273) has a name that only restates its file name: "border bottom right" |
| survey.html | f_0014 (line 81) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 81) has a name that only restates its file name: "border left top" |
| survey.html | f_0015 (line 82) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 82) has a name that only restates its file name: "border top" |
| survey.html | f_0016 (line 83) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 83) has a name that only restates its file name: "border right top" |
| survey.html | f_0017 (line 86) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 86) has a name that only restates its file name: "border left" |
| survey.html | f_0018 (line 91) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 91) has a name that only restates its file name: "top logo next end" |
| survey.html | f_0019 (line 92) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 92) has a name that only restates its file name: "top weather" |
| survey.html | f_0020 (line 93) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 93) has a name that only restates its file name: "top logo next start" |
| survey.html | f_0021 (line 116) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 116) has a name that only restates its file name: "mark" |
| survey.html | f_0022 (line 141) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 141) has a name that only restates its file name: "marker2 w" |
| survey.html | f_0023 (line 152) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 152) has a name that only restates its file name: "marker2 w" |
| survey.html | f_0024 (line 153) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 153) has a name that only restates its file name: "marker2 t" |
| survey.html | f_0025 (line 156) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 156) has a name that only restates its file name: "nav home" |
| survey.html | f_0026 (line 159) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 159) has a name that only restates its file name: "marker2 w" |
| survey.html | f_0027 (line 162) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 162) has a name that only restates its file name: "nav news" |
| survey.html | f_0028 (line 165) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 165) has a name that only restates its file name: "marker2 w" |
| survey.html | f_0029 (line 168) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 168) has a name that only restates its file name: "nav facts" |
| survey.html | f_0030 (line 171) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 171) has a name that only restates its file name: "marker2 w" |
| survey.html | f_0031 (line 174) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 174) has a name that only restates its file name: "nav survey" |
| survey.html | f_0032 (line 177) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 177) has a name that only restates its file name: "marker2 w" |
| survey.html | f_0033 (line 181) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 181) has a name that only restates its file name: "blank 5x5" |
| survey.html | f_0034 (line 205) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| survey.html | f_0035 (line 209) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| survey.html | f_0036 (line 213) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| survey.html | f_0037 (line 237) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| survey.html | f_0038 (line 241) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| survey.html | f_0039 (line 245) | label | 1 | rejected_suspicious | aria-label "res" only restates the name attribute "res" and does not contain the visible text next to the <input> |
| survey.html | f_0040 (line 518) | label | 1 | rejected_suspicious | generic aria-label: "t"; aria-label "t" only restates the name attribute "t" and does not contain the visible text next to the <input> |
| survey.html | f_0041 (line 518) | label | 1 | rejected_suspicious | generic aria-label: "t"; aria-label "t" only restates the name attribute "t" and does not contain the visible text next to the <input> |
| survey.html | f_0042 (line 518) | label | 1 | rejected_suspicious | aria-label "em" only restates the name attribute "em" and does not contain the visible text next to the <input> |
| survey.html | f_0043 (line 520) | label | 1 | rejected_suspicious | generic aria-label: "n"; aria-label "n" only restates the name attribute "n" and does not contain the visible text next to the <input> |
| survey.html | f_0044 (line 520) | label | 1 | rejected_suspicious | aria-label "ev" only restates the name attribute "ev" and does not contain the visible text next to the <input> |
| survey.html | f_0045 (line 588) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 588) has a name that only restates its file name: "border right" |
| survey.html | f_0046 (line 591) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 591) has a name that only restates its file name: "border bottom left" |
| survey.html | f_0047 (line 592) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 592) has a name that only restates its file name: "border bottom" |
| survey.html | f_0048 (line 593) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 593) has a name that only restates its file name: "border bottom right" |
| tickets.html | f_0014 (line 75) | image-alt | 1 | rejected_suspicious | text alternative "border left top" only restates the file name "border_left_top.gif"; accessibility tree: <img> (line 75) has a name that only restates its file name: "border left top" |
| tickets.html | f_0015 (line 76) | image-alt | 1 | rejected_suspicious | text alternative "border top" only restates the file name "border_top.gif"; accessibility tree: <img> (line 76) has a name that only restates its file name: "border top" |
| tickets.html | f_0016 (line 77) | image-alt | 1 | rejected_suspicious | text alternative "border right top" only restates the file name "border_right_top.gif"; accessibility tree: <img> (line 77) has a name that only restates its file name: "border right top" |
| tickets.html | f_0017 (line 80) | image-alt | 1 | rejected_suspicious | text alternative "border left" only restates the file name "border_left.gif"; accessibility tree: <img> (line 80) has a name that only restates its file name: "border left" |
| tickets.html | f_0018 (line 85) | image-alt | 1 | rejected_suspicious | text alternative "top logo next end" only restates the file name "top_logo_next_end.gif"; accessibility tree: <img> (line 85) has a name that only restates its file name: "top logo next end" |
| tickets.html | f_0019 (line 86) | image-alt | 1 | rejected_suspicious | text alternative "top weather" only restates the file name "top_weather.gif"; accessibility tree: <img> (line 86) has a name that only restates its file name: "top weather" |
| tickets.html | f_0020 (line 87) | image-alt | 1 | rejected_suspicious | text alternative "top logo next start" only restates the file name "top_logo_next_start.gif"; accessibility tree: <img> (line 87) has a name that only restates its file name: "top logo next start" |
| tickets.html | f_0021 (line 110) | image-alt | 1 | rejected_suspicious | text alternative "mark" only restates the file name "mark.gif"; accessibility tree: <img> (line 110) has a name that only restates its file name: "mark" |
| tickets.html | f_0022 (line 135) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 135) has a name that only restates its file name: "marker2 w" |
| tickets.html | f_0023 (line 146) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 146) has a name that only restates its file name: "marker2 w" |
| tickets.html | f_0024 (line 147) | image-alt | 1 | rejected_suspicious | text alternative "marker2 t" only restates the file name "marker2_t.gif"; accessibility tree: <img> (line 147) has a name that only restates its file name: "marker2 t" |
| tickets.html | f_0025 (line 150) | image-alt | 1 | rejected_suspicious | text alternative "nav home" only restates the file name "nav_home.gif"; accessibility tree: <img> (line 150) has a name that only restates its file name: "nav home" |
| tickets.html | f_0026 (line 153) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 153) has a name that only restates its file name: "marker2 w" |
| tickets.html | f_0027 (line 156) | image-alt | 1 | rejected_suspicious | text alternative "nav news" only restates the file name "nav_news.gif"; accessibility tree: <img> (line 156) has a name that only restates its file name: "nav news" |
| tickets.html | f_0028 (line 159) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 159) has a name that only restates its file name: "marker2 w" |
| tickets.html | f_0029 (line 162) | image-alt | 1 | rejected_suspicious | text alternative "nav facts" only restates the file name "nav_facts.gif"; accessibility tree: <img> (line 162) has a name that only restates its file name: "nav facts" |
| tickets.html | f_0030 (line 165) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 165) has a name that only restates its file name: "marker2 w" |
| tickets.html | f_0031 (line 168) | image-alt | 1 | rejected_suspicious | text alternative "nav survey" only restates the file name "nav_survey.gif"; accessibility tree: <img> (line 168) has a name that only restates its file name: "nav survey" |
| tickets.html | f_0032 (line 171) | image-alt | 1 | rejected_suspicious | text alternative "marker2 w" only restates the file name "marker2_w.gif"; accessibility tree: <img> (line 171) has a name that only restates its file name: "marker2 w" |
| tickets.html | f_0033 (line 175) | image-alt | 1 | rejected_suspicious | text alternative "blank 5x5" only restates the file name "blank_5x5.gif"; accessibility tree: <img> (line 175) has a name that only restates its file name: "blank 5x5" |
| tickets.html | f_0034 (line 177) | image-alt | 1 | rejected_suspicious | text alternative "headline ticket offers" only restates the file name "headline_ticket_offers.gif"; accessibility tree: <img> (line 177) has a name that only restates its file name: "headline ticket offers" |
| tickets.html | f_0037 (line 206) | image-alt | 1 | rejected_suspicious | text alternative "headline ticket prices" only restates the file name "headline_ticket_prices.gif"; accessibility tree: <img> (line 206) has a name that only restates its file name: "headline ticket prices" |
| tickets.html | f_0044 (line 287) | image-alt | 1 | rejected_suspicious | text alternative "border right" only restates the file name "border_right.gif"; accessibility tree: <img> (line 287) has a name that only restates its file name: "border right" |
| tickets.html | f_0045 (line 290) | image-alt | 1 | rejected_suspicious | text alternative "border bottom left" only restates the file name "border_bottom_left.gif"; accessibility tree: <img> (line 290) has a name that only restates its file name: "border bottom left" |
| tickets.html | f_0046 (line 291) | image-alt | 1 | rejected_suspicious | text alternative "border bottom" only restates the file name "border_bottom.gif"; accessibility tree: <img> (line 291) has a name that only restates its file name: "border bottom" |
| tickets.html | f_0047 (line 292) | image-alt | 1 | rejected_suspicious | text alternative "border bottom right" only restates the file name "border_bottom_right.gif"; accessibility tree: <img> (line 292) has a name that only restates its file name: "border bottom right" |
| 01-bakery-images.html | f_0002 (line 26) | image-alt | 1 | rejected_suspicious | text alternative "sourdough" only restates the file name "sourdough.jpg"; accessibility tree: <img> (line 26) has a name that only restates its file name: "sourdough"; visual (desktop): 0.13% of the page changed outside  |
| 01-bakery-images.html | f_0003 (line 30) | image-alt | 1 | rejected_suspicious | text alternative "croissant" only restates the file name "croissant.jpg"; accessibility tree: <img> (line 30) has a name that only restates its file name: "croissant" |
| 01-bakery-images.html | f_0004 (line 34) | image-alt | 1 | rejected_suspicious | text alternative "wheat divider" only restates the file name "wheat-divider.png"; accessibility tree: <img> (line 34) has a name that only restates its file name: "wheat divider" |
| 01-bakery-images.html | f_0005 (line 36) | image-alt | 1 | rejected_suspicious | text alternative "hours table" only restates the file name "hours-table.png"; accessibility tree: <img> (line 36) has a name that only restates its file name: "hours table"; visual (desktop): 0.31% of the page changed ou |
| 01-bakery-images.html | f_0006 (line 39) | image-alt | 1 | rejected_suspicious | text alternative "map pin" only restates the file name "map-pin.png"; accessibility tree: <img> (line 39) has a name that only restates its file name: "map pin"; visual (desktop): 0.19% of the page changed outside the pa |
| 01-bakery-images.html | f_0007 (line 43) | image-alt | 1 | rejected_suspicious | text alternative "social icon" only restates the file name "social-icon.png"; accessibility tree: <img> (line 43) has a name that only restates its file name: "social icon" |
| 02-newsletter-labels.html | f_0002 (line 33) | label | 1 | rejected_suspicious | aria-label "weekly" only restates the name attribute "weekly" and does not contain the visible text next to the <input> |
| 02-newsletter-labels.html | f_0003 (line 37) | label | 1 | rejected_suspicious | aria-label "topics" only restates the name attribute "topics" and does not contain the visible text next to the <textarea> |
| 02-newsletter-labels.html | f_0004 (line 42) | label | 1 | rejected_suspicious | generic aria-label: "q"; aria-label "q" only restates the name attribute "q" and does not contain the visible text next to the <input> |
| 04-dashboard-roles.html | f_0002 (line 23) | aria-roles | 1 | rejected_suspicious | left a focusable element without a role (role removed instead of corrected) |
| 04-dashboard-roles.html | f_0006 (line 33) | aria-required-attr | 1 | rejected_suspicious | id reference to no element on the page: aria-controls -> "false" |
| 05-settings-aria-values.html | f_0001 (line 15) | aria-valid-attr-value | 1 | rejected_suspicious | accessibility tree: <button> (line 15) lost its expanded state |
| 05-settings-aria-values.html | f_0003 (line 23) | aria-valid-attr-value | 1 | rejected_suspicious | accessibility tree: <button> (line 23) lost its pressed state |
| 07-recipe-mixed.html | f_0002 (line 17) | image-alt | 1 | rejected_suspicious | text alternative "lentil soup bowl" only restates the file name "lentil-soup-bowl.jpg"; accessibility tree: <img> (line 17) has a name that only restates its file name: "lentil soup bowl"; visual (desktop): 1.25% of the  |
| 08-portfolio-ambiguous.html | f_0001 (line 15) | image-alt | 1 | rejected_suspicious | text alternative "a" only restates the file name "a.png"; accessibility tree: <img> (line 15) has a name that only restates its file name: "a" |
| 08-portfolio-ambiguous.html | f_0002 (line 17) | image-alt | 1 | rejected_suspicious | text alternative "ic share 24" only restates the file name "ic_share_24.svg"; accessibility tree: <img> (line 17) has a name that only restates its file name: "ic share 24" |
| 08-portfolio-ambiguous.html | f_0003 (line 18) | image-alt | 1 | rejected_suspicious | text alternative "ic heart 24" only restates the file name "ic_heart_24.svg"; accessibility tree: <img> (line 18) has a name that only restates its file name: "ic heart 24"; visual (desktop): 0.24% of the page changed ou |
| 08-portfolio-ambiguous.html | f_0004 (line 24) | image-alt | 1 | rejected_suspicious | generic alt: "img 2041"; text alternative "img 2041" only restates the file name "IMG_2041.jpg"; accessibility tree: <img> (line 24) now has a generic name "img 2041" |
| 08-portfolio-ambiguous.html | f_0005 (line 25) | image-alt | 1 | rejected_suspicious | generic alt: "img 2057"; text alternative "img 2057" only restates the file name "IMG_2057.jpg"; accessibility tree: <img> (line 25) now has a generic name "img 2057" |
| 08-portfolio-ambiguous.html | f_0006 (line 26) | image-alt | 1 | rejected_suspicious | text alternative "final v3 final" only restates the file name "final-v3-FINAL.png"; accessibility tree: <img> (line 26) has a name that only restates its file name: "final v3 final" |
| 08-portfolio-ambiguous.html | f_0007 (line 30) | image-alt | 1 | rejected_suspicious | text alternative "logo1" only restates the file name "logo1.png"; accessibility tree: <img> (line 30) has a name that only restates its file name: "logo1" |
| 08-portfolio-ambiguous.html | f_0008 (line 31) | image-alt | 1 | rejected_suspicious | text alternative "logo2" only restates the file name "logo2.png"; accessibility tree: <img> (line 31) has a name that only restates its file name: "logo2" |
| 08-portfolio-ambiguous.html | f_0009 (line 34) | image-alt | 1 | rejected_suspicious | text alternative "email address" only restates the file name "email-address.png"; accessibility tree: <img> (line 34) has a name that only restates its file name: "email address" |
| 08-portfolio-ambiguous.html | f_0010 (line 35) | image-alt | 1 | rejected_suspicious | generic alt: "spacer"; text alternative "spacer" only restates the file name "spacer.gif"; accessibility tree: <img> (line 35) now has a generic name "spacer" |
| 09-event-signup.html | f_0002 (line 23) | label | 1 | rejected_suspicious | aria-label "first" only restates the name attribute "first" and does not contain the visible text next to the <input> |
| 09-event-signup.html | f_0003 (line 23) | label | 1 | rejected_suspicious | aria-label "last" only restates the name attribute "last" and does not contain the visible text next to the <input> |
| 09-event-signup.html | f_0005 (line 31) | label | 1 | rejected_suspicious | aria-label "org" only restates the name attribute "org" and does not contain the visible text next to the <input> |
| 10-coworking-crlf.html | f_0002 (line 18) | image-alt | 1 | rejected_suspicious | text alternative "desk" only restates the file name "desk.jpg"; accessibility tree: <img> (line 18) has a name that only restates its file name: "desk" |
| 10-coworking-crlf.html | f_0004 (line 20) | label | 1 | rejected_suspicious | aria-label "days" only restates the name attribute "days" and does not contain the visible text next to the <input> |
| 10-coworking-crlf.html | f_0005 (line 24) | image-alt | 1 | rejected_suspicious | text alternative "desk" only restates the file name "desk.jpg"; accessibility tree: <img> (line 24) has a name that only restates its file name: "desk" |
| 10-coworking-crlf.html | f_0007 (line 26) | label | 1 | rejected_suspicious | aria-label "days" only restates the name attribute "days" and does not contain the visible text next to the <input> |
| 10-coworking-crlf.html | f_0008 (line 30) | image-alt | 1 | rejected_suspicious | text alternative "meeting room" only restates the file name "meeting-room.jpg"; accessibility tree: <img> (line 30) has a name that only restates its file name: "meeting room" |

## Rejections

| Page | Finding | Rule | Tier | Status | Reason |
|---|---|---|---|---|---|
| aria-allowed-attr.html | f_0014 (line 30) | aria-allowed-attr | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-allowed-attr.html | f_0015 (line 31) | aria-allowed-attr | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-allowed-attr.html | f_0017 (line 38) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 38 |
| aria-allowed-attr.html | f_0018 (line 39) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 39 |
| aria-allowed-attr.html | f_0021 (line 42) | aria-allowed-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 42 |
| aria-required-attr.html | f_0001 (line 14) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 14 |
| aria-required-attr.html | f_0002 (line 25) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 25 |
| aria-required-attr.html | f_0004 (line 44) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 44 |
| aria-required-attr.html | f_0009 (line 67) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 67 |
| aria-required-attr.html | f_0013 (line 82) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 82 |
| aria-roles.html | f_0003 (line 34) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 34 |
| aria-valid-attr-value.html | f_0050 (line 51) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0065 (line 68) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0067 (line 78) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0069 (line 88) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0071 (line 98) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0073 (line 109) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0075 (line 121) | aria-valid-attr-value | - | rejected_invalid | generation failed: invalid output after 3 attempts: empty output; output began: "" |
| aria-valid-attr-value.html | f_0187 (line 413) | aria-required-attr | 1 | rejected_persists | aria-required-attr is still reported on the target node |
| color-contrast.html | f_0001 (line 41) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0002 (line 68) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0003 (line 71) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0004 (line 76) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0005 (line 81) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0012 (line 365) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0013 (line 368) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0016 (line 469) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0018 (line 527) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0019 (line 540) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0021 (line 590) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| heading-order.html | f_0002 (line 24) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 24 |
| heading-order.html | f_0003 (line 27) | aria-required-attr | 1 | rejected_regression | introduced 1 new violation(s): aria-valid-attr-value at line 27 |
| 01-bakery-images.html | f_0001 (line 15) | image-alt | 1 | rejected_regression | introduced 2 new violation(s): target-size at line 15, target-size at line 18 |
| 05-settings-aria-values.html | f_0002 (line 20) | aria-valid-attr-value | 1 | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 20 |
| 06-pricing-contrast.html | f_0005 (line 34) | color-contrast | 1 | rejected_persists | color-contrast is still reported on the target node |
| 07-recipe-mixed.html | f_0003 (line 18) | heading-order | 1 | rejected_regression | introduced 1 new violation(s): heading-order at line 24 |

## Verifier checks

Every applied patch is compared with the original page: axe-core with the full WCAG 2.x A/AA rule set, static suspicion checks on the patched source, and:

- accessibility tree (computed role, name, states, focusability of every element): on
- focus order (Tab sequence): on
- visual (full-page screenshots): desktop 1280x900; limit 0.10% of pixels changed outside the patched elements; layout shifts measured, not enforced

| | Patches |
|---|---:|
| Compared beyond axe | 653 |
| Rejected by the accessibility-tree comparison | 162 |
| Rejected by the focus-order comparison | 0 |
| Rejected by the visual comparison | 5 |
| Moved other elements on the page (layout shift, reported only) | 28 |

Largest pixel change outside the patched elements on a page without layout shift: 1.248%.

## Definitions

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

**What the verifier catches.** Of the 653 patches that applied, the full verifier rejected 250 (38.3%). A pipeline
that shipped everything would have called all 250 fixed; one that only re-ran axe would still have shipped 223 of
them. Most of those are the 159 `image-alt` patches whose alt text only restates the file name
(`plot-map.png` → `alt="plot map"`) and the 53 `label` patches whose `aria-label` only restates the field's `name` or
`id` (`aria-label="fail1"`, `aria-label="org"`), which axe accepts and the source checks reject. Seven
`aria-controls="false"` (an id reference to no element), removed focusable roles, and 14 patches that broke something
else on the page (new violations) make up the rest.

**What each layer adds, on this corpus.** Axe alone removes 27 patches (regressions and violations still present).
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
