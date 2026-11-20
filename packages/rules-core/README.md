# verifa11y-rules-core

The rule set [`verifa11y`](https://www.npmjs.com/package/verifa11y) ships with: `image-alt`, `label`,
`heading-order`, `aria-allowed-attr`, `aria-required-attr`, `aria-valid-attr-value`, `aria-roles` and
`color-contrast`. Tier-0 rules carry deterministic codemods that decline whatever they cannot prove; the rest need
judgment (tier 1). Every rule says what it declines by design.

Written against the experimental Rule API in [`verifa11y-core`](https://www.npmjs.com/package/verifa11y-core); see
the [rule author guide](https://github.com/mateogsilvaa/verifa11y/blob/main/docs/rule-author-guide.md). Apache-2.0.
