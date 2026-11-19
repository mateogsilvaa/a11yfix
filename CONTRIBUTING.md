# Contributing to a11yfix

Thanks for helping. a11yfix makes one promise: a patch it calls *verified* was re-audited and broke nothing.
Every contribution is judged against that promise first.

## Ground rules

- **The verifier is never weakened to make a number look better.** A change that lets more patches through must
  come with a test that shows those patches are correct. The sabotage test (`packages/core/test/sabotage.test.ts`)
  must keep rejecting every sabotaged patch.
- **Tier 0 stays at 100% precision.** A deterministic codemod that is wrong even once on the corpus is a bug. When a
  case needs judgment, the codemod declines (returns `null`) and the finding goes to tier 1.
- **No telemetry, no accounts, no required network access.** a11yfix must work on a machine with no network beyond
  the page under audit. The model tier is optional.
- **Bad benchmark numbers are published, not hidden.** If your change lowers a metric, the PR says so and explains why.

## Setup

```sh
npm ci
npx playwright install chromium-headless-shell
npm test            # builds every package, then runs all tests (real browser)
```

Node.js 20 or later. The engines are pinned: `axe-core` and `playwright` use exact versions, because a benchmark is
only comparable with a run that used the same engines. Bumping either is its own PR, with the benchmark re-run and
the change in numbers explained.

## Repository layout

| Package | What it is |
|---|---|
| `packages/core` (`a11yfix-core`) | audit, source mapping, validation, the verifier, the pipeline, the Rule API, the optional LLM tier |
| `packages/rules-core` (`a11yfix-rules-core`) | the core rules; tier-0 codemods |
| `packages/cli` (`a11yfix-cli`) | the `a11yfix` command |

Architecture decisions are recorded in [`docs/adr/`](docs/adr). If your change contradicts one, write a new ADR that
supersedes it.

## Writing or changing a rule

Read the [rule author guide](docs/rule-author-guide.md) and the [rule versioning policy](docs/rule-versioning.md).
In short: a rule change bumps the rule's `version`, comes with tests for what it fixes **and what it declines**, and
re-runs `npm run bench:codemod`.

## Pull requests

1. One topic per PR. Open an issue first for anything larger than a bug fix.
2. `npm test` passes locally (it includes the sabotage test).
3. If you touched a rule, the verifier or the pipeline: re-run `npm run bench:codemod` and commit the updated
   `bench/codemod/` output. The diff of `report.md` is part of the review.
4. Use the PR template. Say what you checked and what you did not.

## Commit messages

Imperative mood, short subject line, a body that explains *why*. Reference issues with `#123`.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing you agree that your contributions are licensed under the Apache License 2.0 (see `LICENSE`).
