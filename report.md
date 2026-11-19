# a11yfix benchmark report

**Status: the tier-1 (model) benchmark has not been run yet.** The environment this repository was built in had no
Anthropic API key, and this file only ever holds measured numbers. Generate it with:

```sh
export ANTHROPIC_API_KEY=...
npm run bench
```

That runs tier 0 (codemods) and tier 1 (`claude-opus-5-5`) over the 22 pages in [`corpus/`](corpus), overwrites this
file with the results broken down by tier, writes every patch, diff and verdict to `bench/auto/`, and compares the run
with the offline benchmark.

Meanwhile, the offline tier-0 run is measured: [bench/codemod/report.md](bench/codemod/report.md) (22 pages, 662
violations, 136 tier-0 patches proposed, 136 verified: 100% precision, 20.5% fix rate), with an analysis.

a11yfix does not guarantee WCAG conformance.
