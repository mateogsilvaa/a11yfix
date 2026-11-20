# 0014. A GitHub Action that suggests only verified fixes, on the lines they change

## Context
Phase 6 is distribution, and a pull-request check is where most people would meet a11yfix without installing
anything. It is also where an overconfident tool does the most damage: a suggestion button makes a patch one click
from being merged, and a green check reads as "accessible". The npm name `a11yfix` belongs to an unrelated project,
so the action cannot `npx a11yfix`.

## Decision
A composite action, `action.yml` at the repository root, and a small workspace package, `packages/action`
(private, not published), with the logic.

- **Same engine, same path.** The action installs this repository from its own lockfile (`npm ci --ignore-scripts`),
  builds it, and runs the CLI: `audit` then `fix --verify --mode <mode> [--strict]`, one run per changed HTML file so
  artifacts of files with the same name cannot collide. It reads the per-finding artifacts back; it makes no decision
  about a patch that the CLI did not make.
- **Codemods by default; a model only when named.** `mode` defaults to `codemod`. `auto` and `llm` require the
  `generator-cmd` input; `ANTHROPIC_API_KEY` and `A11YFIX_GENERATOR_CMD` in the environment are ignored, and the
  GitHub token is removed from the CLI's environment.
- **One review, suggestions for verified patches only.** Each verified patch is re-located with the core validator,
  shrunk to the lines it changes (`subEdits`) and posted as a ```` ```suggestion ```` replacing exactly those lines.
  Fixes sharing a line become one suggestion (a batch commit cannot conflict); of two fixes editing the same code only
  the first is suggested, as `combine` does for the patch. Suspicious patches are listed in the body, never suggested,
  whatever `strict` says; `strict` only shapes the downloadable patch.
- **Only lines GitHub can comment on.** A suggestion must lie inside one hunk of the pull request's diff (RIGHT
  side). Verified fixes elsewhere, or ones a suggestion cannot express (a line joined with the next), are listed in
  the body with their diff and stay in the patch.
- **The head, not the merge commit.** The action compares `HEAD` with `pull_request.head.sha` and stops if they
  differ, because suggestions are anchored to the head's lines.
- **The caveats travel with every comment.** The conformance warning and the caveats move from the MCP server to
  `a11yfix-core` (`CONFORMANCE`, `CAVEATS`, `WARNING`), and every comment and the body quote them verbatim. A clean
  audit says it is not a review of the rest of WCAG.
- **Read-only tokens fall back to the job summary.** On fork pull requests (and on 403/404 when posting) the full
  report, with suggestions as diffs, goes to `$GITHUB_STEP_SUMMARY`. A 422 on the inline comments retries once with
  the suggestions in the body.
- **No noise on re-runs.** Suggestions carry a content key and are not re-posted; a review identical to the last
  a11yfix review is not posted again; a clean audit posts nothing.
- **Failing is opt-in.** `fail-on: none | findings | unfixed`, default `none`.
- Tests: the payload test turns known patches into the exact comment payload (no network); an end-to-end test runs
  the built action against a git checkout and a fake GitHub API on `127.0.0.1` (posting, de-duplication, fork
  fallback, wrong checkout). CI runs the composite action itself on pull requests with a filter that matches nothing,
  to exercise installation without posting.

## Consequences
The action is usable today by pinning a commit; tagging and publishing to the Marketplace is left to the maintainer.
Installation costs a lockfile install, a TypeScript build and a browser download per job (the browser is cached).
Pre-existing problems outside the changed lines are reported but not suggested, which keeps reviews about the pull
request. A suggestion's button makes a fix easy to merge; the verifier's limits (ADR 0012) and the caveat in every
comment are what stand between that and a false sense of conformance.
