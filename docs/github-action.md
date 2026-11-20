# GitHub Action

The verifa11y action reviews pull requests. It audits the HTML files a pull request changes, runs
`fix --verify --strict --mode codemod` on each, and posts **one review** whose inline comments are GitHub
suggestions, one per verified fix, on the exact lines it changes. A reviewer accepts or ignores each suggestion with
the usual buttons. Decision record: [ADR 0016](adr/0016-github-action.md).

> verifa11y results are axe-clean on the checked rules, not WCAG conformance. Every comment and the review body say so,
> with the same caveats as the MCP server. A person reviews every suggestion before it is committed.

## Use it

Copy [`examples/verifa11y-pull-request.yml`](examples/verifa11y-pull-request.yml) to `.github/workflows/verifa11y.yml`:

```yaml
on:
  pull_request:
    paths: ["**/*.html", "**/*.htm"]

permissions:
  contents: read
  pull-requests: write

jobs:
  verifa11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: mateogsilvaa/verifa11y@COMMIT_SHA
        id: verifa11y
```

- **Check out the head commit.** `actions/checkout` checks out the merge commit by default, whose line numbers can
  differ from the head's. The action compares `HEAD` with the pull request head and stops with an error if they
  differ, instead of suggesting on the wrong lines.
- **Pin a commit.** No release is tagged or published to the Marketplace yet; use a full commit SHA. The action builds
  and runs the CLI from that commit of this repository, not from npm.
- **Node.js 20 or later** must be on the runner (`actions/setup-node`). The action installs its dependencies with
  `npm ci --ignore-scripts` from its own lockfile, then Playwright's `chromium-headless-shell` (cached with
  `actions/cache`; on Linux `--with-deps` installs system libraries with `sudo`).
- **Use `pull_request`, not `pull_request_target`.** The action needs no secrets and no write access beyond posting
  a review. On `pull_request_target` it warns.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `paths` | `**/*.html`, `**/*.htm` | Globs on repository-relative paths, one per line or comma-separated; a leading `!` excludes. Removed files are ignored. |
| `mode` | `codemod` | `codemod`: deterministic tier-0 fixes, no model. `auto` or `llm` also use tier 1 and then require `generator-cmd`. |
| `strict` | `true` | Leave suspicious patches out of the downloadable patch. Suspicious patches are never suggested either way. |
| `fail-on` | `none` | `none`: never fail on results. `findings`: fail when any finding remains in the audited files (or a file could not be audited). `unfixed`: fail when a finding has no verified fix, or a file could not be audited. |
| `generator-cmd` | | Tier-1 generator: any agent or model CLI, same protocol as `--generator-cmd` ([agents.md](agents.md)). |
| `max-files` | `50` | Audit at most this many changed HTML files; the rest are listed as not audited (and count as unfixed). |
| `working-directory` | `.` | Where the pull request is checked out, relative to the workspace (`path` of `actions/checkout`). |
| `github-token` | `github.token` | Reads the pull request; posts the review when it has `pull-requests: write`. |

Tier 1 runs only when the workflow names a generator. The action never falls back to `ANTHROPIC_API_KEY` or
`VERIFA11Y_GENERATOR_CMD` from the environment:

```yaml
      - uses: mateogsilvaa/verifa11y@COMMIT_SHA
        with:
          mode: auto
          generator-cmd: claude -p # installed and signed in by an earlier step
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The command must already be installed on the runner. Its patches go through the same verifier as the codemods'.
Fork pull requests get no secrets, so there the generator usually fails and those findings are reported as rejected
or skipped, never suggested.

## Outputs

| Output | Meaning |
|---|---|
| `findings` | Findings in the audited files. |
| `verified` | Findings with a verified fix. |
| `suggested` | Verified fixes posted as suggestions. |
| `suspicious` | Patches that silenced a violation suspiciously: need a human, never suggested. |
| `skipped` | Findings nothing was attempted for: need a human. |
| `unfixed` | Findings without a verified fix, plus files that could not be audited. |
| `patch` | Path of the combined `git apply` patch. |
| `results` | Path of `results.json`: every finding, its status, reason and patch, with `conformance` and `caveats`. |
| `review-url` | URL of the review, when one was posted. |

## What the review contains

- **Inline suggestions: verified fixes only.** A fix is suggested when the verifier accepted it (axe no longer reports
  the violation, no new WCAG A/AA violation, the static, accessibility-tree, focus-order and visual checks found
  nothing worse) and it sits on lines the pull request's diff shows. Fixes that touch the same line are merged into
  one suggestion, so accepting them as a batch cannot conflict; of two fixes that edit the same code, only the first
  is suggested.
- **The review body accounts for every finding:** verified fixes it could not suggest inline (outside the changed
  lines, or not expressible as a suggestion) with their diff, **suspicious patches (never suggested)**, patches the
  verifier rejected, skipped findings, and files that could not be audited, each with its reason. Then the caveats.
- **No duplicates.** A suggestion carries a content key and is not posted again on a later push; when nothing
  changed since the last verifa11y review, no new review is posted. A clean audit posts no review.

## Fork pull requests and read-only tokens

On a pull request from a fork the workflow token is read-only, so the action does not try to post. The full report,
with every suggestion as a diff, goes to the **job summary**, and the patch to the `patch` output (upload it with
`actions/upload-artifact`, as in the example). The same happens when posting fails with 403 or 404 (the workflow
lacks `pull-requests: write`).

## Limits

- Static HTML files only, as the CLI. Templates (`.njk`, `.vue`, ...) are not audited.
- GitHub only accepts comments on lines in the diff. Pre-existing problems elsewhere in a changed file are reported
  in the body and the patch, not suggested.
- When GitHub returns no diff for a file (very large or binary), its fixes are reported, not suggested.
- Each file is audited in its own CLI run: a browser starts twice per file. `max-files` bounds the cost.
