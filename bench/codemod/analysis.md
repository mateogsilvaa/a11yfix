## Analysis

**Eval first.** On the 73 held-out eval pages, tier 0 proposed 18 patches (8 `heading-order`, 8 `aria-allowed-attr`,
2 `label`) and the verifier accepted all 18: 100% [82.4–100]. Eighteen patches cannot tell 100% from 85%, so this
says tier 0 did not fail on pages it was not written for, not that it never will. The eval fix rate is 2.4%
[1.5–3.8] (18 of 738): 677 of the 738 eval violations are `color-contrast`, which tier 0 never touches, and three
pages hold 547 of the 738. 29 of the 73 eval pages have no violation of the patched rules. The rest of this analysis
was written about the 22 dev pages, which were read while the codemods were written.

This run is **tier 0 only**: deterministic codemods, no model, no network. It is the floor verifa11y gives on a
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
