# a11yfix-action

The logic of the a11yfix GitHub Action (`action.yml` at the repository root). Private; not published to npm.

- `src/main.ts`: the entry point the action runs. Lists the pull request's files, runs the a11yfix CLI (`audit`, then
  `fix --verify`) on the changed HTML, posts one review or writes the job summary.
- `src/suggest.ts`: turns verified patches into suggestions on exact lines of the pull request's diff.
- `src/review.ts`: comment and review bodies, with the caveats from `a11yfix-core`.
- `src/diff.ts`, `src/glob.ts`, `src/github.ts`: hunk ranges, path filters, the few REST calls.

Usage, inputs and outputs: [docs/github-action.md](../../docs/github-action.md). Decision record:
[ADR 0016](../../docs/adr/0016-github-action.md).
