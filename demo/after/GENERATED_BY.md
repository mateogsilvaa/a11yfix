# How demo/after was produced

- Generator: `heuristic`
- Date: 2026-11-19
- Findings in demo/before: 9
- Outcomes: rejected_suspicious 3, verified 6
- Subset violations left in demo/after: 3

`index.html` is demo/before with every verified patch applied. `accepted.diff` lists those patches;
`results.json` has every patch, including the rejected ones and why. Regenerate with `npm run demo`.
