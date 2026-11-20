# 0012. Verification beyond axe: accessibility tree, focus order, pixels

## Context
axe is a rule engine: when a rule stops firing, the markup is acceptable to axe, not necessarily to a person. Fake
fixes that axe accepts were caught by static heuristics on the patched source, which only see what is written in the
patch: not a name that comes from `aria-labelledby`, a state that disappeared, an element taken out of the tab order,
or a stylesheet change that repaints the page.

## Decision
The verifier probes the original and the patched page in the same browser session as the axe run:

- **Accessibility tree**: Chromium's computed tree over CDP (`Accessibility.getFullAXTree`), mapped to element paths
  with `DOM.getDocument`. For every element: role, name, description, ignored, focusable, and user-facing states.
  Suspicious: a name, role or state lost; an exposed, named or focusable element no longer exposed; focusability lost;
  a new generic or file-name name.
- **Focus order**: real Tab presses from the top of the document. Suspicious: elements that leave the tab order, or
  untouched elements whose relative order changed.
- **Visual**: full-page screenshots per viewport; pixel diff computed in the browser with a canvas (no image library),
  masking the patched elements (those inside the edit, the innermost element around it, and the target). Suspicious:
  more than `--max-visual-change` (default 0.1%) of the page changed outside the mask when the layout did not move.
  Layout shifts are counted and only enforced with `--max-layout-shift`, because legitimate fixes (a heading level)
  change size.

All three use the same node identity as axe violations: source offsets, shifted after the edit, elements inside the
edit matched by kind and order (headings are one kind, since heading fixes change the tag).

New violations can be filtered by impact (`--regression-impact`, default: every impact rejects).

## Consequences
The verifier rejects fakes that axe and the static checks both accept (tested in `deepcheck.test.ts` and the second
sabotage suite). On the corpus, none of the 136 tier-0 patches was rejected by the new checks, and the cost is about
0.3 s per verified patch. The checks are on by default in the CLI and off by default in the library API (pass
`checks`). Chromium-only: the accessibility tree is Chromium's, not a screen reader's.
