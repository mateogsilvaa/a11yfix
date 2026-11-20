# Rule author guide

> The Rule API is **experimental** until the verifier covers the accessibility tree and visual regressions
> (roadmap phase 3, ADR 0006). Rules live in this repository until then. Write against `verifa11y-core` and expect
> small breaking changes in minor versions.

## Anatomy of a rule

```ts
import { defineRule, setAttr, type FixContext, type CodemodResult } from "verifa11y-core";

export const myRule = defineRule({
  id: "my-rule",              // permanent, kebab-case (docs/rule-versioning.md)
  version: "1.0.0",           // semver of this rule's behavior
  axe: "my-axe-rule",         // the axe-core rule that detects violations
  wcag: ["4.1.2"],
  level: 1,                   // 1 structural, 2 harder (contrast-like)
  tier: 0,                    // 0 = deterministic codemod, 1 = needs judgment (model)
  confidence: "high",
  description: "One sentence a user can understand.",
  detect: (finding) => true,  // optional: narrow axe's findings
  fix,                        // required for tier 0
  guidance: "What the model should do when the codemod declines.",
  verify: (ctx) => [],        // optional: extra suspicion reasons (can only add)
});

function fix(ctx: FixContext): CodemodResult | null {
  // ctx.element (parse5), ctx.startTag (exact source text), ctx.src, ctx.ids ...
  return { before: ctx.startTag!, after: setAttr(ctx.startTag!, "x", "y"), rationale: "why" };
}
```

## Choosing a tier

Ask: *is there exactly one correct fix that can be computed from the markup alone?*

- **Yes, always** → tier 0, and the codemod never declines.
- **Yes, in recognizable sub-cases** → tier 0 with a codemod that handles those sub-cases and **declines
  everything else**. Most core rules are like this.
- **No** (the fix depends on meaning, design, or state the markup does not show) → tier 1, no codemod.

Tier 0 is held to **100% precision** on the corpus. A codemod that declines too often is fine; a codemod that is
wrong once is a bug.

## The codemod contract

- **Pure and deterministic.** Same input, same output. No network, no randomness, no clock.
- **Exact source.** `before` must be a verbatim substring of `ctx.src`. Build `after` from the source text
  (`ctx.startTag`, slices of `ctx.src`), never from a re-serialized DOM.
- **Small.** At most 6 changed lines in at most 2 places. A codemod whose edit would not fit is treated as a decline.
- **One problem.** Fix the target finding. Touch other code only when your change would otherwise break it (see
  `heading-order`, which re-levels a sibling the change would break, and leaves pre-existing problems alone).
- **No silencing.** Never hide, delete, or blank things out. The verifier rejects it anyway, and the sabotage test
  exists to make sure it keeps doing so.

## Ambiguous cases, resolved

These are the calls the core rules make, and why. Use them as precedent.

| Situation | Decision | Why |
|---|---|---|
| `h1 … h3 A … h3 B` (A flagged) | tier 0: both become `h2`; decline if that needs more than 2 edits | siblings must stay siblings, or the outline says something new |
| `<input>` with a bare text node next to it, alone in its parent | tier 0: wrap both in `<label>` | the association is unambiguous and `<label>` is inline, so the layout does not change |
| `<p>Question?</p><textarea>` alone in a row | tier 0: `aria-labelledby` the `<p>` | turning the `<p>` into a `<label>` would change block layout |
| `<td>Name</td><td><input> <input></td>` | decline | one visible label for two controls (first/last name): which part is which needs judgment |
| `role="buton"` | tier 0: `role="button"` | unique valid role within edit distance 2 |
| `role="chekbox"` without `aria-checked` | decline | the correction would immediately need a state the markup does not give |
| `role="range"` (abstract) | decline | the intended concrete role (slider? progressbar? meter?) needs judgment |
| `aria-level="2"` on a plain `<div>` | tier 0: remove it | disallowed attributes are ignored by assistive technology, so removal does not change what users get |
| `aria-checked` on a `<button>` | decline | a state on the wrong role usually means the role is wrong (`aria-pressed`, `role="switch"`) |
| `aria-expanded="yes"` | tier 0: `"true"` | the author's intent is explicit |
| `aria-hidden="yes"` | decline | the mechanical mapping would hide content; that is never a tier-0 decision |
| `aria-live="loud"` | decline | `assertive` or `polite` is a judgment about interruption |
| missing `aria-checked` on `role="checkbox"` | tier 1 | `"false"` satisfies axe whether or not it is true |
| image without `alt` | tier 1 | what an image means is never mechanical; file-name alt text is the classic false fix |

## Tests

Every rule ships tests in `packages/rules-core/test/` for:

1. each case the codemod fixes, verified against a real browser (`verifyPatch` must return `verified`);
2. each case it declines, especially the tempting ones;
3. a version bump in the rule when behavior changes.

Then run `npm run bench:codemod` and commit the updated report. Tier-0 precision must stay at 100%.

## Proposing a new rule

Open an issue with the **Rule proposal** template. A rule is accepted when:

- it maps to a clear WCAG success criterion (or a well-established best practice, labelled as such);
- its fixes can be checked by the verify loop (detection by axe, or by a check you add to the verifier);
- if it claims tier 0, determinism is possible for a meaningful share of cases;
- it comes with corpus pages that exercise easy and ambiguous cases.
