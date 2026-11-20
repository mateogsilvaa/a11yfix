# How demo/after was produced

- Mode: tier 0 codemods only (no model), strict
- Verifier: axe-core, static checks, accessibility tree, focus order, visual (desktop)
- Date: 2026-11-20
- Findings in demo/before: 9
- Outcomes: skipped 5, verified 4
- Violations of the patched rules left in demo/after: 5

`index.html` is demo/before with every verified patch applied, and `verifa11y.patch` is the same change as a
patch (`git apply`). `results.json` has every finding, including the skipped and rejected ones and why.
Regenerate with `npm run demo`.
