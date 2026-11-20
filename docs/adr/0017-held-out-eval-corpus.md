# 0017. A held-out eval corpus, reported apart from dev

## Context
All 22 benchmark pages had been read and debugged while the codemods and prompts were written. Their numbers show
that a11yfix works on the cases it was built for, not how it does on pages nobody has looked at: tuning on the test
set makes every rate optimistic by an unknown amount. With 22 pages, most per-rule samples were also too small for
the Wilson intervals to say much.

## Decision
- `corpus/eval/` is a held-out set. Its pages are never used to write or tune codemods, rules, prompts or the
  verifier: nobody reads their markup or per-finding outcomes while working on a change, and nobody iterates on a
  change until the eval numbers go up. Everything else in `corpus/` is dev.
- A page used for tuning moves to dev in the same commit and is logged in `corpus/README.md`. Pages never move from
  dev to eval. New pages go to eval first, with their source and license next to them.
- A page is eval when a directory named `eval` sits between `--corpus` (inclusive) and the page. `a11yfix bench`
  reports eval and dev separately when a run has both: a side-by-side table, then for each set its summary, tiers,
  comparison, verifier ablation, outcomes and per-rule table, all with 95% Wilson intervals. `metrics.json` keeps
  the combined `overall`, `byTier` and `byRule` and adds `bySet`. `--compare` compares each set with the same set
  of the other run. A corpus without an `eval` directory is reported as before.
- The first eval set is 73 pages with licenses that allow redistribution: Start Bootstrap templates (MIT), the
  Bootstrap 5.3.9 examples (MIT, CC BY 3.0), MDN learning-area accessibility pages (CC0) and axe-core fixtures not
  used in dev (MPL-2.0). Pages were added without being selected by how they score.

## Consequences
- The numbers to quote are the eval numbers. Dev numbers stay in the report, labelled as used for tuning.
- The eval set loses value every time someone looks at a page in it; the move-to-dev rule makes that visible
  instead of silent, and the set needs new pages over time.
- The eval pages are templates and teaching pages, not a sample of the web. They are held out, not representative,
  and the report does not claim more than that.
- Reports are longer: the per-set sections repeat for eval and dev.
