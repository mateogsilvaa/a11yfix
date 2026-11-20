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
