# a11yfix benchmark report

- Generator: `heuristic`
- Corpus: `./corpus` (22 pages)
- axe-core 4.14.1, run 2026-11-19, total wall time 80.0 s

## Summary

| Metric | Value |
|---|---|
| Pages | 22 |
| Violations detected | 662 |
| Patches proposed | 652 |
| Patches applied (passed shape validation) | 652 |
| Patches verified | 468 |
| **Fix rate** (verified / detected) | **70.7%** |
| **Precision** (verified / proposed) | **71.8%** |
| False-fix rate (suspicious / (verified + suspicious)) | 25.7% |
| Regression rate (regressions / applied) | 1.5% |
| Mean cost per verified fix | 0 tokens |
| Total tokens (input + output + cache read + cache write) | 0 |
| Mean time per page | 4.6 s |
| Subset violations left after applying all verified patches | 199 of 662 |
| WCAG A/AA violations (all rules) before → after | 809 → 346 |

## Outcomes

| Status | Count |
|---|---|
| verified | 468 |
| rejected_persists | 12 |
| rejected_regression | 10 |
| rejected_suspicious | 162 |
| rejected_invalid (bad patch shape) | 0 |
| rejected_invalid (no usable output) | 10 |
| rejected_apply_failed | 0 |

## By rule

| Rule | Level | Detected | Proposed | Verified | Fix rate | Precision | False-fix | Regression | Tokens / fix |
|---|---|---|---|---|---|---|---|---|---|
| image-alt | 1 | 159 | 159 | 1 | 0.6% | 0.6% | 99.4% | 0.6% | 0 |
| label | 1 | 55 | 55 | 51 | 92.7% | 92.7% | 7.3% | 0.0% | 0 |
| heading-order | 1 | 7 | 7 | 6 | 85.7% | 85.7% | 0.0% | 14.3% | 0 |
| aria-allowed-attr | 1 | 151 | 149 | 146 | 96.7% | 98.0% | 0.0% | 2.0% | 0 |
| aria-required-attr | 1 | 34 | 33 | 33 | 97.1% | 100.0% | 0.0% | 0.0% | 0 |
| aria-valid-attr-value | 1 | 58 | 51 | 46 | 79.3% | 90.2% | 0.0% | 9.8% | 0 |
| aria-roles | 1 | 17 | 17 | 16 | 94.1% | 94.1% | 5.9% | 0.0% | 0 |
| color-contrast | 2 | 181 | 181 | 169 | 93.4% | 93.4% | 0.0% | 0.0% | 0 |

## By page

| Page | Detected | Verified | Left after combining | WCAG A/AA before → after | Time |
|---|---|---|---|---|---|
| external/axe-core/aria-allowed-attr.html | 23 | 18 | 9 | 33 → 19 | 2.5 s |
| external/axe-core/aria-required-attr.html | 16 | 11 | 5 | 24 → 13 | 2.3 s |
| external/axe-core/aria-roles.html | 22 | 22 | 0 | 60 → 38 | 2.4 s |
| external/axe-core/aria-valid-attr-value.html | 189 | 182 | 7 | 198 → 16 | 22.7 s |
| external/axe-core/color-contrast.html | 22 | 11 | 11 | 28 → 17 | 2.4 s |
| external/axe-core/heading-order.html | 3 | 3 | 0 | 3 → 0 | 0.6 s |
| external/axe-core/image-alt.html | 19 | 4 | 15 | 22 → 18 | 1.8 s |
| external/axe-core/label.html | 14 | 14 | 0 | 28 → 14 | 2.7 s |
| external/w3c-bad/home.html | 71 | 38 | 33 | 84 → 46 | 11.0 s |
| external/w3c-bad/news.html | 75 | 36 | 39 | 86 → 50 | 20.7 s |
| external/w3c-bad/survey.html | 71 | 44 | 27 | 83 → 39 | 11.8 s |
| external/w3c-bad/tickets.html | 70 | 44 | 26 | 81 → 37 | 10.0 s |
| handwritten/01-bakery-images.html | 7 | 0 | 7 | 10 → 10 | 0.9 s |
| handwritten/02-newsletter-labels.html | 4 | 3 | 1 | 5 → 2 | 0.7 s |
| handwritten/03-docs-headings.html | 2 | 2 | 0 | 4 → 2 | 0.6 s |
| handwritten/04-dashboard-roles.html | 7 | 6 | 1 | 7 → 1 | 1.1 s |
| handwritten/05-settings-aria-values.html | 7 | 6 | 1 | 9 → 3 | 1.2 s |
| handwritten/06-pricing-contrast.html | 7 | 6 | 1 | 7 → 1 | 1.1 s |
| handwritten/07-recipe-mixed.html | 7 | 5 | 2 | 8 → 3 | 1.1 s |
| handwritten/08-portfolio-ambiguous.html | 10 | 0 | 10 | 12 → 12 | 1.4 s |
| handwritten/09-event-signup.html | 7 | 7 | 1 | 8 → 2 | 1.3 s |
| handwritten/10-coworking-crlf.html | 9 | 6 | 3 | 9 → 3 | 0.9 s |

## Rejections

Every rejected patch, with the verifier's reason.

| Page | Finding | Rule | Status | Reason |
|---|---|---|---|---|
| aria-allowed-attr.html | f_0014 (line 30) | aria-allowed-attr | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-allowed-attr.html | f_0015 (line 31) | aria-allowed-attr | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-allowed-attr.html | f_0017 (line 38) | aria-allowed-attr | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 38 |
| aria-allowed-attr.html | f_0018 (line 39) | aria-allowed-attr | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 39 |
| aria-allowed-attr.html | f_0021 (line 42) | aria-allowed-attr | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 42 |
| aria-required-attr.html | f_0001 (line 14) | aria-valid-attr-value | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 14 |
| aria-required-attr.html | f_0002 (line 25) | aria-valid-attr-value | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 25 |
| aria-required-attr.html | f_0004 (line 44) | aria-valid-attr-value | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 44 |
| aria-required-attr.html | f_0005 (line 52) | aria-required-attr | rejected_invalid | generation failed: heuristic: no default for aria-controls |
| aria-required-attr.html | f_0009 (line 67) | aria-valid-attr-value | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 67 |
| aria-valid-attr-value.html | f_0050 (line 51) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-valid-attr-value.html | f_0065 (line 68) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-valid-attr-value.html | f_0067 (line 78) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-valid-attr-value.html | f_0069 (line 88) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-valid-attr-value.html | f_0071 (line 98) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-valid-attr-value.html | f_0073 (line 109) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| aria-valid-attr-value.html | f_0075 (line 121) | aria-valid-attr-value | rejected_invalid | generation failed: heuristic: offending attribute not found in axe data |
| color-contrast.html | f_0001 (line 41) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0002 (line 68) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0003 (line 71) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0004 (line 76) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0005 (line 81) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0012 (line 365) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0013 (line 368) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0016 (line 469) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0018 (line 527) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0019 (line 540) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| color-contrast.html | f_0021 (line 590) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| image-alt.html | f_0001 (line 16) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0002 (line 17) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0003 (line 18) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0004 (line 19) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0005 (line 24) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0006 (line 29) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0007 (line 31) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0008 (line 32) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0009 (line 33) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0010 (line 34) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0011 (line 36) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0013 (line 37) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0016 (line 46) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0017 (line 47) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| image-alt.html | f_0018 (line 48) | image-alt | rejected_suspicious | generic alt: "Img"; text alternative "Img" only restates the file name "img.jpg" |
| home.html | f_0014 (line 178) | image-alt | rejected_suspicious | text alternative "Border left top" only restates the file name "border_left_top.gif" |
| home.html | f_0015 (line 179) | image-alt | rejected_suspicious | text alternative "Border top" only restates the file name "border_top.gif" |
| home.html | f_0016 (line 180) | image-alt | rejected_suspicious | text alternative "Border right top" only restates the file name "border_right_top.gif" |
| home.html | f_0017 (line 183) | image-alt | rejected_suspicious | text alternative "Border left" only restates the file name "border_left.gif" |
| home.html | f_0018 (line 188) | image-alt | rejected_suspicious | text alternative "Top logo next end" only restates the file name "top_logo_next_end.gif" |
| home.html | f_0019 (line 189) | image-alt | rejected_suspicious | text alternative "Top weather" only restates the file name "top_weather.gif" |
| home.html | f_0020 (line 190) | image-alt | rejected_suspicious | text alternative "Top logo next start" only restates the file name "top_logo_next_start.gif" |
| home.html | f_0021 (line 213) | image-alt | rejected_suspicious | text alternative "Mark" only restates the file name "mark.gif" |
| home.html | f_0022 (line 238) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0023 (line 249) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0024 (line 250) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| home.html | f_0025 (line 253) | image-alt | rejected_suspicious | text alternative "Nav home" only restates the file name "nav_home.gif" |
| home.html | f_0026 (line 256) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0027 (line 259) | image-alt | rejected_suspicious | text alternative "Nav news" only restates the file name "nav_news.gif" |
| home.html | f_0028 (line 262) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0029 (line 265) | image-alt | rejected_suspicious | text alternative "Nav facts" only restates the file name "nav_facts.gif" |
| home.html | f_0030 (line 268) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0031 (line 271) | image-alt | rejected_suspicious | text alternative "Nav survey" only restates the file name "nav_survey.gif" |
| home.html | f_0032 (line 274) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0033 (line 278) | image-alt | rejected_suspicious | text alternative "Blank 5x5" only restates the file name "blank_5x5.gif" |
| home.html | f_0034 (line 285) | image-alt | rejected_suspicious | text alternative "Headline middle" only restates the file name "headline_middle.gif" |
| home.html | f_0035 (line 286) | image-alt | rejected_suspicious | text alternative "Headline middle" only restates the file name "headline_middle.gif" |
| home.html | f_0036 (line 287) | image-alt | rejected_suspicious | text alternative "Headline middle" only restates the file name "headline_middle.gif" |
| home.html | f_0037 (line 306) | image-alt | rejected_suspicious | text alternative "Blank 5x5" only restates the file name "blank_5x5.gif" |
| home.html | f_0038 (line 310) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| home.html | f_0039 (line 311) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0041 (line 317) | image-alt | rejected_suspicious | text alternative "Teaser right1" only restates the file name "teaser_right1.jpg" |
| home.html | f_0042 (line 332) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| home.html | f_0044 (line 338) | image-alt | rejected_suspicious | text alternative "Teaser right2" only restates the file name "teaser_right2.jpg" |
| home.html | f_0045 (line 359) | image-alt | rejected_suspicious | text alternative "Border right" only restates the file name "border_right.gif" |
| home.html | f_0046 (line 362) | image-alt | rejected_suspicious | text alternative "Border bottom left" only restates the file name "border_bottom_left.gif" |
| home.html | f_0047 (line 363) | image-alt | rejected_suspicious | text alternative "Border bottom" only restates the file name "border_bottom.gif" |
| home.html | f_0048 (line 364) | image-alt | rejected_suspicious | text alternative "Border bottom right" only restates the file name "border_bottom_right.gif" |
| news.html | f_0014 (line 80) | image-alt | rejected_suspicious | text alternative "Border left top" only restates the file name "border_left_top.gif" |
| news.html | f_0015 (line 81) | image-alt | rejected_suspicious | text alternative "Border top" only restates the file name "border_top.gif" |
| news.html | f_0016 (line 82) | image-alt | rejected_suspicious | text alternative "Border right top" only restates the file name "border_right_top.gif" |
| news.html | f_0017 (line 85) | image-alt | rejected_suspicious | text alternative "Border left" only restates the file name "border_left.gif" |
| news.html | f_0018 (line 90) | image-alt | rejected_suspicious | text alternative "Top logo next end" only restates the file name "top_logo_next_end.gif" |
| news.html | f_0019 (line 91) | image-alt | rejected_suspicious | text alternative "Top weather" only restates the file name "top_weather.gif" |
| news.html | f_0020 (line 92) | image-alt | rejected_suspicious | text alternative "Top logo next start" only restates the file name "top_logo_next_start.gif" |
| news.html | f_0021 (line 115) | image-alt | rejected_suspicious | text alternative "Mark" only restates the file name "mark.gif" |
| news.html | f_0022 (line 140) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0023 (line 151) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0024 (line 152) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0025 (line 155) | image-alt | rejected_suspicious | text alternative "Nav home" only restates the file name "nav_home.gif" |
| news.html | f_0026 (line 158) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0027 (line 161) | image-alt | rejected_suspicious | text alternative "Nav news" only restates the file name "nav_news.gif" |
| news.html | f_0028 (line 164) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0029 (line 167) | image-alt | rejected_suspicious | text alternative "Nav facts" only restates the file name "nav_facts.gif" |
| news.html | f_0030 (line 170) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0031 (line 173) | image-alt | rejected_suspicious | text alternative "Nav survey" only restates the file name "nav_survey.gif" |
| news.html | f_0032 (line 176) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0033 (line 180) | image-alt | rejected_suspicious | text alternative "Blank 5x5" only restates the file name "blank_5x5.gif" |
| news.html | f_0034 (line 197) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0035 (line 198) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0036 (line 201) | image-alt | rejected_suspicious | text alternative "Headline middle" only restates the file name "headline_middle.gif" |
| news.html | f_0037 (line 202) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0038 (line 207) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0039 (line 218) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0040 (line 219) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0041 (line 220) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0042 (line 223) | image-alt | rejected_suspicious | text alternative "Headline middle" only restates the file name "headline_middle.gif" |
| news.html | f_0043 (line 228) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0044 (line 241) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0045 (line 242) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0046 (line 243) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| news.html | f_0047 (line 246) | image-alt | rejected_suspicious | text alternative "Headline middle" only restates the file name "headline_middle.gif" |
| news.html | f_0048 (line 251) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| news.html | f_0049 (line 268) | image-alt | rejected_suspicious | text alternative "Border right" only restates the file name "border_right.gif" |
| news.html | f_0050 (line 271) | image-alt | rejected_suspicious | text alternative "Border bottom left" only restates the file name "border_bottom_left.gif" |
| news.html | f_0051 (line 272) | image-alt | rejected_suspicious | text alternative "Border bottom" only restates the file name "border_bottom.gif" |
| news.html | f_0052 (line 273) | image-alt | rejected_suspicious | text alternative "Border bottom right" only restates the file name "border_bottom_right.gif" |
| survey.html | f_0014 (line 81) | image-alt | rejected_suspicious | text alternative "Border left top" only restates the file name "border_left_top.gif" |
| survey.html | f_0015 (line 82) | image-alt | rejected_suspicious | text alternative "Border top" only restates the file name "border_top.gif" |
| survey.html | f_0016 (line 83) | image-alt | rejected_suspicious | text alternative "Border right top" only restates the file name "border_right_top.gif" |
| survey.html | f_0017 (line 86) | image-alt | rejected_suspicious | text alternative "Border left" only restates the file name "border_left.gif" |
| survey.html | f_0018 (line 91) | image-alt | rejected_suspicious | text alternative "Top logo next end" only restates the file name "top_logo_next_end.gif" |
| survey.html | f_0019 (line 92) | image-alt | rejected_suspicious | text alternative "Top weather" only restates the file name "top_weather.gif" |
| survey.html | f_0020 (line 93) | image-alt | rejected_suspicious | text alternative "Top logo next start" only restates the file name "top_logo_next_start.gif" |
| survey.html | f_0021 (line 116) | image-alt | rejected_suspicious | text alternative "Mark" only restates the file name "mark.gif" |
| survey.html | f_0022 (line 141) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| survey.html | f_0023 (line 152) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| survey.html | f_0024 (line 153) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| survey.html | f_0025 (line 156) | image-alt | rejected_suspicious | text alternative "Nav home" only restates the file name "nav_home.gif" |
| survey.html | f_0026 (line 159) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| survey.html | f_0027 (line 162) | image-alt | rejected_suspicious | text alternative "Nav news" only restates the file name "nav_news.gif" |
| survey.html | f_0028 (line 165) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| survey.html | f_0029 (line 168) | image-alt | rejected_suspicious | text alternative "Nav facts" only restates the file name "nav_facts.gif" |
| survey.html | f_0030 (line 171) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| survey.html | f_0031 (line 174) | image-alt | rejected_suspicious | text alternative "Nav survey" only restates the file name "nav_survey.gif" |
| survey.html | f_0032 (line 177) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| survey.html | f_0033 (line 181) | image-alt | rejected_suspicious | text alternative "Blank 5x5" only restates the file name "blank_5x5.gif" |
| survey.html | f_0040 (line 518) | label | rejected_suspicious | generic aria-label: "T" |
| survey.html | f_0041 (line 518) | label | rejected_suspicious | generic aria-label: "T" |
| survey.html | f_0043 (line 520) | label | rejected_suspicious | generic aria-label: "N" |
| survey.html | f_0045 (line 588) | image-alt | rejected_suspicious | text alternative "Border right" only restates the file name "border_right.gif" |
| survey.html | f_0046 (line 591) | image-alt | rejected_suspicious | text alternative "Border bottom left" only restates the file name "border_bottom_left.gif" |
| survey.html | f_0047 (line 592) | image-alt | rejected_suspicious | text alternative "Border bottom" only restates the file name "border_bottom.gif" |
| survey.html | f_0048 (line 593) | image-alt | rejected_suspicious | text alternative "Border bottom right" only restates the file name "border_bottom_right.gif" |
| tickets.html | f_0014 (line 75) | image-alt | rejected_suspicious | text alternative "Border left top" only restates the file name "border_left_top.gif" |
| tickets.html | f_0015 (line 76) | image-alt | rejected_suspicious | text alternative "Border top" only restates the file name "border_top.gif" |
| tickets.html | f_0016 (line 77) | image-alt | rejected_suspicious | text alternative "Border right top" only restates the file name "border_right_top.gif" |
| tickets.html | f_0017 (line 80) | image-alt | rejected_suspicious | text alternative "Border left" only restates the file name "border_left.gif" |
| tickets.html | f_0018 (line 85) | image-alt | rejected_suspicious | text alternative "Top logo next end" only restates the file name "top_logo_next_end.gif" |
| tickets.html | f_0019 (line 86) | image-alt | rejected_suspicious | text alternative "Top weather" only restates the file name "top_weather.gif" |
| tickets.html | f_0020 (line 87) | image-alt | rejected_suspicious | text alternative "Top logo next start" only restates the file name "top_logo_next_start.gif" |
| tickets.html | f_0021 (line 110) | image-alt | rejected_suspicious | text alternative "Mark" only restates the file name "mark.gif" |
| tickets.html | f_0022 (line 135) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| tickets.html | f_0023 (line 146) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| tickets.html | f_0024 (line 147) | image-alt | rejected_suspicious | text alternative "Marker2 t" only restates the file name "marker2_t.gif" |
| tickets.html | f_0025 (line 150) | image-alt | rejected_suspicious | text alternative "Nav home" only restates the file name "nav_home.gif" |
| tickets.html | f_0026 (line 153) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| tickets.html | f_0027 (line 156) | image-alt | rejected_suspicious | text alternative "Nav news" only restates the file name "nav_news.gif" |
| tickets.html | f_0028 (line 159) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| tickets.html | f_0029 (line 162) | image-alt | rejected_suspicious | text alternative "Nav facts" only restates the file name "nav_facts.gif" |
| tickets.html | f_0030 (line 165) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| tickets.html | f_0031 (line 168) | image-alt | rejected_suspicious | text alternative "Nav survey" only restates the file name "nav_survey.gif" |
| tickets.html | f_0032 (line 171) | image-alt | rejected_suspicious | text alternative "Marker2 w" only restates the file name "marker2_w.gif" |
| tickets.html | f_0033 (line 175) | image-alt | rejected_suspicious | text alternative "Blank 5x5" only restates the file name "blank_5x5.gif" |
| tickets.html | f_0034 (line 177) | image-alt | rejected_suspicious | text alternative "Headline ticket offers" only restates the file name "headline_ticket_offers.gif" |
| tickets.html | f_0037 (line 206) | image-alt | rejected_suspicious | text alternative "Headline ticket prices" only restates the file name "headline_ticket_prices.gif" |
| tickets.html | f_0044 (line 287) | image-alt | rejected_suspicious | text alternative "Border right" only restates the file name "border_right.gif" |
| tickets.html | f_0045 (line 290) | image-alt | rejected_suspicious | text alternative "Border bottom left" only restates the file name "border_bottom_left.gif" |
| tickets.html | f_0046 (line 291) | image-alt | rejected_suspicious | text alternative "Border bottom" only restates the file name "border_bottom.gif" |
| tickets.html | f_0047 (line 292) | image-alt | rejected_suspicious | text alternative "Border bottom right" only restates the file name "border_bottom_right.gif" |
| 01-bakery-images.html | f_0001 (line 15) | image-alt | rejected_regression | introduced 2 new violation(s): target-size at line 15, target-size at line 18 |
| 01-bakery-images.html | f_0002 (line 26) | image-alt | rejected_suspicious | text alternative "Sourdough" only restates the file name "sourdough.jpg" |
| 01-bakery-images.html | f_0003 (line 30) | image-alt | rejected_suspicious | text alternative "Croissant" only restates the file name "croissant.jpg" |
| 01-bakery-images.html | f_0004 (line 34) | image-alt | rejected_suspicious | text alternative "Wheat divider" only restates the file name "wheat-divider.png" |
| 01-bakery-images.html | f_0005 (line 36) | image-alt | rejected_suspicious | text alternative "Hours table" only restates the file name "hours-table.png" |
| 01-bakery-images.html | f_0006 (line 39) | image-alt | rejected_suspicious | text alternative "Map pin" only restates the file name "map-pin.png" |
| 01-bakery-images.html | f_0007 (line 43) | image-alt | rejected_suspicious | text alternative "Social icon" only restates the file name "social-icon.png" |
| 02-newsletter-labels.html | f_0004 (line 42) | label | rejected_suspicious | generic aria-label: "Q" |
| 04-dashboard-roles.html | f_0002 (line 23) | aria-roles | rejected_suspicious | left a focusable element without a role (role removed instead of corrected) |
| 05-settings-aria-values.html | f_0002 (line 20) | aria-valid-attr-value | rejected_regression | introduced 1 new violation(s): aria-required-attr at line 20 |
| 06-pricing-contrast.html | f_0005 (line 34) | color-contrast | rejected_persists | color-contrast is still reported on the target node |
| 07-recipe-mixed.html | f_0002 (line 17) | image-alt | rejected_suspicious | text alternative "Lentil soup bowl" only restates the file name "lentil-soup-bowl.jpg" |
| 07-recipe-mixed.html | f_0003 (line 18) | heading-order | rejected_regression | introduced 1 new violation(s): heading-order at line 24 |
| 08-portfolio-ambiguous.html | f_0001 (line 15) | image-alt | rejected_suspicious | text alternative "A" only restates the file name "a.png" |
| 08-portfolio-ambiguous.html | f_0002 (line 17) | image-alt | rejected_suspicious | text alternative "Ic share 24" only restates the file name "ic_share_24.svg" |
| 08-portfolio-ambiguous.html | f_0003 (line 18) | image-alt | rejected_suspicious | text alternative "Ic heart 24" only restates the file name "ic_heart_24.svg" |
| 08-portfolio-ambiguous.html | f_0004 (line 24) | image-alt | rejected_suspicious | generic alt: "IMG 2041"; text alternative "IMG 2041" only restates the file name "IMG_2041.jpg" |
| 08-portfolio-ambiguous.html | f_0005 (line 25) | image-alt | rejected_suspicious | generic alt: "IMG 2057"; text alternative "IMG 2057" only restates the file name "IMG_2057.jpg" |
| 08-portfolio-ambiguous.html | f_0006 (line 26) | image-alt | rejected_suspicious | text alternative "Final v3 FINAL" only restates the file name "final-v3-FINAL.png" |
| 08-portfolio-ambiguous.html | f_0007 (line 30) | image-alt | rejected_suspicious | text alternative "Logo1" only restates the file name "logo1.png" |
| 08-portfolio-ambiguous.html | f_0008 (line 31) | image-alt | rejected_suspicious | text alternative "Logo2" only restates the file name "logo2.png" |
| 08-portfolio-ambiguous.html | f_0009 (line 34) | image-alt | rejected_suspicious | text alternative "Email address" only restates the file name "email-address.png" |
| 08-portfolio-ambiguous.html | f_0010 (line 35) | image-alt | rejected_suspicious | generic alt: "Spacer"; text alternative "Spacer" only restates the file name "spacer.gif" |
| 10-coworking-crlf.html | f_0002 (line 18) | image-alt | rejected_suspicious | text alternative "Desk" only restates the file name "desk.jpg" |
| 10-coworking-crlf.html | f_0005 (line 24) | image-alt | rejected_suspicious | text alternative "Desk" only restates the file name "desk.jpg" |
| 10-coworking-crlf.html | f_0008 (line 30) | image-alt | rejected_suspicious | text alternative "Meeting room" only restates the file name "meeting-room.jpg" |

## Definitions

- **Detected**: violations of the patched rule subset reported by axe-core, one per node.
- **Proposed**: the generator returned a well-formed patch (valid JSON matching the schema, within 3 attempts).
- **Applied**: the patch passed shape validation (exact `before` substring, ≤ 6 lines, ≤ 2 hunks) and the patched page was re-audited.
- **Verified**: after applying the patch to a copy, the original violation is gone from the target node, no new WCAG 2.x A/AA violation appeared anywhere on the page, and no suspicion heuristic fired (element removed, aria-hidden or role=presentation/none added, content hidden, generic alt text or alt text that only restates the file name, alt="" on the only content of a link or button, a focusable element left without a role, a generic aria-label on a form control).
- **False-fix rate**: of the patches that made axe happy, the share flagged as suspicious (silencing instead of fixing).
- **Regression rate**: of the applied patches, the share that introduced a new violation.
- Token costs count input, output, and prompt-cache reads and writes. Dollar figures are estimates from list prices.

"Verified" means *axe-core no longer reports it and nothing else broke*. It does not mean a human confirmed the page is accessible. See the README's Limitations section.

## Analysis

This run uses the **heuristic baseline**: about 150 lines of rule-by-rule string edits, no model. It
exists for two reasons: to exercise the whole pipeline offline, and to set the bar the LLM generator has
to clear. Its numbers say more about the judge than about the fixer.

**ARIA rules look solved, and mostly are mechanical.** `aria-allowed-attr`, `aria-roles` and
`aria-required-attr` reach 94-97% fix rates by deleting the offending attribute or adding the missing
one with a default value. axe is satisfied, and often that is the right fix. But a default is not
the same as a correct value: `aria-checked="false"` silences `aria-required-attr` on a custom checkbox
whether or not it looks checked. Neither axe nor the verifier can see the visual state, so these count
as verified. This is the clearest example of why "verified" means "axe-clean and nothing else broke",
not "correct".

**The verifier catches the cheap tricks it was built for.** The baseline's `image-alt` patches derive
alt text from the file name (`q3-sales.png` becomes `alt="Q3 sales"`). axe accepts every one of them.
The verifier rejects 157 of 159 as suspicious because the text is generic or only restates the file name (one more is a regression). Before that
heuristic existed, this same baseline scored 88% on `image-alt`. That 87-point gap is the difference
between "axe is quiet" and "the image has a useful text alternative".
`label` patches built from the `name` attribute (the W3C survey's Mr/Mrs radio buttons, `name="t"`, get `aria-label="T"`) are caught the same
way.

**Regressions are real and come from the coupling between ARIA rules.** 10 patches were rejected for
introducing new violations. Eight of them come from deleting an attribute such as `aria-checked` from a
widget role that *requires* it: `aria-valid-attr-value` goes away and `aria-required-attr`
appears. The verifier re-audits the whole page against every WCAG 2.x A/AA rule, not only the rule
being fixed, which is what makes this visible. The one `heading-order` regression is the "previous level
+ 1" rule creating a skip further down the outline, and one image fix tripped axe's `target-size` check.

**Color contrast passes axe by overriding the design.** 169 of 181 contrast findings are "fixed" by
an inline `color: #000000` (or `#ffffff` on dark backgrounds). That clears WCAG 1.4.3 and also turns a
white-on-yellow call-to-action button into black-on-yellow. The verifier has no notion of design intent,
so these count as verified. The 12 that persist are axe-core fixture cases where the element's own
`color` is not what decides the measured contrast, so an inline color on the element does not change
the result.

**What the LLM run has to show.** On mechanical ARIA rules the baseline is already strong, so the LLM's
value has to show up where judgment is needed: `image-alt` (describe function, choose `alt=""` for
decorative images, name the link destination), `label` (reuse visible text), contrast (keep the hue),
and correct widget state values. The report for the LLM generator (`npm run bench`) puts both runs
side by side.
