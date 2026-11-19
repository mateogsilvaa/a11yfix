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
