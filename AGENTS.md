# Instructions for AI coding agents

This file is for agents (Claude Code, Codex, Cursor, Aider, and others) working in this repository or using a11yfix
on another one. Humans: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Using a11yfix to fix accessibility in any project

a11yfix is a judge you can call from the shell. It tells you what is wrong with exact source lines, and whether your
fix really fixed it without hiding anything or breaking something else.

```sh
# once
git clone https://github.com/mateogsilvaa/a11yfix.git && cd a11yfix
npm ci && npx playwright install chromium-headless-shell && npm run build
alias a11yfix="node $PWD/packages/cli/dist/cli.js"
```

Loop for each HTML file you change:

1. `a11yfix audit page.html --out findings.json`: violations with rule, WCAG criterion and source lines.
2. Fix **one finding at a time with the smallest edit**. Never make a violation disappear by hiding, deleting or
   silencing: no `aria-hidden`, `role="presentation"`, `inert`, `display:none`, or generic text like "image" or
   "field". The verifier detects these and rejects the patch.
3. Write the edit as JSON to `patch.json`:
   `{"findingId": "f_0003", "rationale": "…", "before": "<exact text from the file>", "after": "…", "confidence": "high|medium|low"}`
4. `a11yfix verify page.html patch.json --findings findings.json --out verdict.json`. Apply the edit only if it exits
   0. If it is rejected, read `reason` in `verdict.json` and try a better fix, or leave the finding for a human.
   Do not work around the verifier.

Or let a11yfix drive you: `a11yfix fix findings.json --verify --strict --generator-cmd "<your CLI>"` sends you one
finding at a time on stdin and keeps only the patches that verify. Protocol: [docs/agents.md](docs/agents.md).

If your client speaks MCP, use the `a11yfix-mcp` server instead of the shell: `rules` → `audit` → `fix` (writes a
patch, never edits the file) → the user runs `git apply` → human review; `verify` for fixes you write yourself. Setup
and the exact meaning of every status: [docs/agents.md](docs/agents.md).

For a live site: `a11yfix site <url>` audits it (it does not patch). Use it only on sites you are allowed to crawl.

a11yfix does not guarantee WCAG conformance. Never tell the user "the page is accessible now": say what was verified,
what was rejected or skipped and why, and that a person must review it.

## Working on this repository

- TypeScript ESM, npm workspaces: `packages/core`, `packages/rules-core`, `packages/cli`, `packages/mcp`,
  `packages/action` (the GitHub Action, `action.yml` at the root). Node 20+.
- `npm test` builds and runs every test with a real browser, including both sabotage suites. It must pass.
- `npm run bench:codemod` when you touch rules, the verifier or the pipeline. Tier 0 must stay at 100% precision.
- Never weaken the verifier to improve a number. Never commit benchmark numbers you did not measure.
- Code, docs and commit messages in English. Decisions that change behaviour get an ADR in `docs/adr/`.
