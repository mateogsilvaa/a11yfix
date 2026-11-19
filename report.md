# a11yfix benchmark report

**Status: the LLM benchmark has not been run yet.** The environment this repository was built in had no
Anthropic API key, and this file only ever holds measured numbers. Generate it with:

```sh
export ANTHROPIC_API_KEY=...
npm run bench
```

That runs audit, fix and verify with `claude-opus-5-5` over the 22 pages in [`corpus/`](corpus), overwrites
this file with the results, writes every patch, diff and verdict to `bench/llm/`, and adds a side-by-side
comparison with the heuristic baseline.

Meanwhile, the offline baseline has been measured: [bench/heuristic/report.md](bench/heuristic/report.md)
(22 pages, 662 violations, fix rate 70.7%, precision 71.8%), with an analysis of what it shows about using
axe-core as the judge.
