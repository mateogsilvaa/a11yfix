# a11yfix

**a11yfix audits HTML for accessibility violations, writes a concrete patch for each one, applies it to a copy,
re-audits, and keeps only the patches that provably fixed the violation without breaking anything else.** The result
is a standard `.patch` you can `git apply` and put in a pull request, plus a report of everything that was fixed,
rejected, or left for a human, and why.

Auditors like axe and Lighthouse stop at detection. a11yfix closes the loop to the fix, and does not trust itself:
every patch, whether it comes from a deterministic codemod, a model, or **any AI agent you plug in**, goes through the
same verifier. The verifier checks more than axe does: it compares the browser's accessibility tree, the keyboard
focus order and the rendered pixels before and after each patch.

> **Scope, up front.** a11yfix **patches static HTML files on disk**. It can also **crawl and audit a live site**
> (`a11yfix site`), with scripts running, but site mode only reports: a live page has no source file to patch.
> Templates and JavaScript frameworks are not patched (roadmap phase 2). See [Limitations](#limitations).
>
> **a11yfix does not guarantee WCAG conformance.** "Verified" means the checks below found the violation gone and
> nothing else worse. It is not a human review.
>
> **No telemetry, no account, no server.** The only network traffic is the page under audit and, only if you
> configure one, the model or agent that writes tier-1 patches.

```
$ a11yfix audit demo/before/index.html --out findings.json
9 finding(s) in demo/before/index.html (0.3 s, axe 4.14.1)

$ a11yfix fix findings.json --verify --strict --mode codemod --out patches
demo/before/index.html: 9 finding(s), mode codemod, verifying
  f_0001 image-alt: skipped (needs judgment (tier-1 rule without codemod); no model configured)
  ...
  f_0002 aria-roles [tier 0]: verified
  f_0004 heading-order [tier 0]: verified
  f_0006 aria-roles [tier 0]: verified
  f_0008 aria-valid-attr-value [tier 0]: verified
  {"skipped":5,"verified":4}; 5 subset violation(s) left after the patch
wrote patches/a11yfix.patch: 4 change(s). Apply with: git apply patches/a11yfix.patch
```

```diff
-    <nav role="navigaton">
+    <nav role="navigation">
...
-    <h3>Rent a plot</h3>
+    <h2>Rent a plot</h2>
...
-    <h3>Volunteer</h3>
+    <h2>Volunteer</h2>
```

(Real output, [`demo/after/a11yfix.patch`](demo/after/a11yfix.patch). The sibling heading moves with the one axe
flagged, so the page outline keeps saying the same thing.)

## Why

Web accessibility is a legal obligation in more and more places (the European Accessibility Act, the ADA, with WCAG 2.2
as the technical reference), and most small teams never get to it because fixing is expensive and opaque. A report
with 300 violations does not turn into work done. A reviewed three-line diff in a pull request does.

## How it works

```
HTML file
  → auditor          Playwright + axe-core (pinned): patched rules + every WCAG 2.x A/AA rule
  → findings.json    one object per violating node, mapped to exact source lines
  → tier 0           the rule's deterministic codemod, if it can prove the fix (else it declines)
  → tier 1           a model or any agent CLI, only for what needs judgment (optional)
  → shape validator  JSON schema, `before` is an exact substring, ≤ 6 lines, ≤ 2 hunks
  → VERIFIER         apply to a copy; axe, static checks, accessibility tree, focus order, pixels
  → output           a11yfix.patch (git apply), per-finding JSON, report, optional SQLite
```

### Tiers

| | Tier 0: codemods | Tier 1: model or agent |
|---|---|---|
| Used for | fixes that can be computed from the markup alone | fixes that need judgment about meaning, design or state |
| Rules | `label`, `heading-order`, `aria-roles`, `aria-allowed-attr`, `aria-valid-attr-value` (the cases they can prove) | `image-alt`, `color-contrast`, `aria-required-attr`, and whatever tier 0 declines |
| Cost | zero, offline, reproducible | tokens or local compute |
| Bar | **100% precision** on the corpus, enforced in CI | measured and published, good or bad |

`--mode auto` (default) runs tier 0 and sends the rest to tier 1 if one is configured, otherwise skips it.
`--mode codemod` never uses tier 1. `--mode llm` sends everything to tier 1 (for comparison only: mechanical fixes
through a model are precision and money thrown away).

Codemods decline aggressively. `role="buton"` → `role="button"` (unique valid role within edit distance 2), but
`role="chekbox"` is declined, because the correction would immediately need an `aria-checked` the markup does not
give. `aria-expanded="yes"` → `"true"`, but `aria-hidden="yes"` is declined: hiding content is never a mechanical
decision. More in the [rule author guide](docs/rule-author-guide.md).

### Tier 1 with any model or AI agent

Tier 1 is not tied to one provider. Any command that reads a request on stdin and prints a patch as JSON works:

```sh
# a local model, fully offline
a11yfix fix findings.json --verify --generator-cmd "ollama run qwen3:8b --think=false"
# a coding agent's CLI (docs/agents.md says which ones are tested)
a11yfix fix findings.json --verify --generator-cmd "claude -p"
a11yfix fix findings.json --verify --generator-cmd "codex exec -"
# your own script, with a structured request
a11yfix fix findings.json --verify --generator-cmd "python my_fixer.py" --generator-input json
```

Agents answer in prose, with markdown fences around the JSON; a11yfix finds the patch object in the output, retries
twice with the error when it cannot, and then **verifies the patch exactly like every other one**. A weak model
produces more rejected patches, never wrong ones in the output. Without `--generator-cmd`, tier 1 uses the built-in
Anthropic client (`claude-opus-5-5`) if `ANTHROPIC_API_KEY` is set.

The reverse also works: an agent that is fixing a page can use a11yfix as its judge (`audit`, propose a patch,
`verify`, read the JSON verdict). See [docs/agents.md](docs/agents.md) for both directions and the exact protocol;
[AGENTS.md](AGENTS.md) has ready-made instructions that coding agents pick up when they open this repository.

### MCP server: a11yfix as a tool for any agent

`a11yfix-mcp` serves a11yfix over the [Model Context Protocol](https://modelcontextprotocol.io) (revision 2026-07-28,
v2 SDK; 2025-era hosts still work), so any MCP client (Claude Desktop, Claude Code, Cursor, VS Code, and others) can
call it:

| Tool | Does |
|---|---|
| `rules` | lists the rules: tier, WCAG criteria, and what each codemod declines by design |
| `audit` | findings for an HTML file, with source lines, tier and rule guidance |
| `fix` | runs the codemods (offline by default), verifies every patch, writes a `git apply` patch under `<out>/<runId>/`; never edits the file |
| `verify` | runs the full verifier on an edit the agent proposes, without touching the file |

Every result is structured JSON that carries `conformance: "axe-clean on the checked rules, not WCAG conformance"`
and its caveats, and its text starts with that warning: agents summarize results, and "4 verified" must not become
"your page is accessible". The agent writes the judgment fixes itself and a11yfix decides whether they hold. Files are
read and written only inside `--root`. The contract for agents is [docs/agents.md](docs/agents.md).

```sh
# Claude Code
claude mcp add a11yfix -- node /path/to/a11yfix/packages/mcp/dist/server.js --root .
```

```json
{
  "mcpServers": {
    "a11yfix": {
      "command": "node",
      "args": ["/path/to/a11yfix/packages/mcp/dist/server.js", "--root", "/path/to/your/project"]
    }
  }
}
```

(The JSON form goes in Claude Desktop's `claude_desktop_config.json`, Cursor's `.cursor/mcp.json`, and similar.)

### GitHub Action: verified suggestions on pull requests

On `pull_request`, the action audits the HTML files the pull request changes, runs `fix --verify --strict` with the
codemods (tier 1 only with a `generator-cmd` the workflow names), and posts one review whose inline comments are
GitHub suggestions, one per verified fix, on the exact lines it changes. Suspicious, rejected and skipped findings are
listed in the review body for a person, never suggested; every comment carries the same caveats as the MCP server.
Fork pull requests (read-only token) get the report in the job summary instead. `fail-on: none|findings|unfixed`.

```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.pull_request.head.sha }}
- uses: actions/setup-node@v4
  with:
    node-version: 22
- uses: mateogsilvaa/a11yfix@COMMIT_SHA # no release tagged yet: pin a commit
```

Full example, inputs and outputs: [docs/github-action.md](docs/github-action.md).

### The verifier

For each patch that passes shape validation:

1. Apply it to an in-memory copy of the file and load the copy in Chromium exactly as the original loads.
2. **axe-core**: the original violation must be gone from the target node, and **no new WCAG 2.x A/AA violation may
   appear anywhere on the page**.
3. **Static suspicion checks** on the patched source: the target element removed; `aria-hidden="true"`, `inert`,
   `role="presentation"` or `role="none"` added; content hidden or made invisible (clip, opacity 0, font-size 0,
   off-screen text); generic alt text or alt text that only restates the file name; `alt=""` on the only content of a
   link or button; an invalid role deleted from a focusable element; a generic or one-character label.
4. **Accessibility tree**: the browser's computed role, name, states and focusability of every element, before and
   after. A patch is suspicious if an element loses its name, role or a state (`expanded`, `checked`, ...), stops
   being exposed to assistive technology, stops being focusable, or gets a generic name, wherever the name comes from
   (`aria-labelledby`, CSS, `title`). axe can be satisfied by all of these.
5. **Focus order**: the page is walked with Tab before and after. Elements that leave the tab order, or a reordered
   sequence of untouched elements, make the patch suspicious.
6. **Visual**: full-page screenshots per viewport. If pixels change outside the patched elements beyond a threshold
   (default 0.1% of the page, `--max-visual-change`), the patch is suspicious: a contrast "fix" that recolours the
   whole page fails here. Layout shifts (a heading that grows and pushes content down) are measured and reported, and
   enforced only with `--max-layout-shift`.

Statuses: `verified`, `rejected_persists`, `rejected_regression`, `rejected_suspicious`, `rejected_invalid`,
`rejected_apply_failed`, and `skipped` (nothing attempted). `--regression-impact` sets the minimum impact for a new
violation to reject a patch (default: any).

Suspicious patches get their own section in the report. They are included in `a11yfix.patch` so a reviewer sees them
in context, unless you pass **`--strict`**, which leaves them out (use it in CI). Rules can add checks; they cannot
remove these.

**The sabotage test.** If the verifier degraded silently, every number this project publishes would be a lie. The test
suite generates hundreds of deliberately fake fixes over the hand-written corpus (hiding, deleting, `inert`,
`role="presentation"`, generic and file-name alt text, cosmetic no-ops, hallucinated source, focusable elements taken
out of the tab order, contrast "fixes" that repaint the page) and fails if the verifier accepts a single one. A second
suite shows fakes that **axe and the static checks both accept** and only the accessibility-tree, focus or visual
comparison rejects, and honest fixes that pass all of them.

### Site mode

```sh
a11yfix site https://staging.example.com/ --depth 2 --max-pages 100 --viewports desktop,mobile \
  --basic-auth "$STAGING_USER:$STAGING_PASS" --db a11yfix.sqlite --incremental
```

- Crawls the start URL's origin only, to `--depth` links and `--max-pages` pages, seeded from `sitemap.xml`; honours
  `robots.txt` (RFC 9309, with `Crawl-delay`) unless you pass `--ignore-robots` for a site you own.
- Renders every page for real: scripts run, the audit waits for network idle, once per viewport (desktop, tablet,
  mobile or `WIDTHxHEIGHT`), and each finding says in which viewports it appears.
- Captures a screenshot of each finding's element.
- Deduplicates pages by a hash of the rendered DOM (`/` and `/index.html` are audited once), and groups findings with
  the same rule and markup across pages: one template issue reported as one, with the pages it affects.
- Authentication for staging: `--header`, `--cookie`, `--basic-auth` (or `A11YFIX_BASIC_AUTH`), sent to the target
  origin only.
- Sandbox: the browser loads only the target origin and origins you allow with `--allow-origin`; every other request
  is blocked and counted. One isolated browser context per page, bounded concurrency, `--delay` between requests.
- `--db` stores sites, runs, pages, findings, patches and verifications in SQLite (`node:sqlite`, Node ≥ 22.13).
  `--incremental` re-renders only pages whose HTML changed since the last run.

Writes `site-report.md`, `site.json` and `screenshots/`. Site mode does not patch: fix the source files with
`a11yfix fix`.

For untrusted sites, run a11yfix in the container: see [docs/sandbox.md](docs/sandbox.md).

### Design notes

- **DOM ↔ source mapping** ([ADR 0003](docs/adr/0003-dom-to-source-mapping.md)). The browser computes each violating
  node's element path; the same path is walked in a parse5 tree with source locations. Findings carry exact source
  lines, and codemods and prompts work on real source text.
- **Page scripts blocked with CSP in file mode** ([ADR 0002](docs/adr/0002-block-scripts-with-csp.md)), not by
  disabling JavaScript (which stops timers and hangs axe). Pages are served from a fake origin; every other origin is
  blocked. Audits are offline and deterministic.
- **Node identity across an edit** ([ADR 0004](docs/adr/0004-regressions-over-full-wcag-set.md)). Violations,
  accessibility-tree nodes, focus stops and element boxes are all keyed by source offset; offsets after the edit shift,
  elements inside the edited span are matched by kind and order.
- **Verification beyond axe** ([ADR 0012](docs/adr/0012-verification-beyond-axe.md)): the accessibility tree comes from
  Chromium over CDP, focus order from real Tab presses, pixel diffs are computed in the browser (no image library).
- **Patches are verified one by one, then combined.** Each patch is split into minimal line edits; a patch that
  conflicts with one already taken is skipped as a whole, never half-applied. The combined page is audited once more.

## Install

Requires Node.js 20+ (Node 22.13+ for `--db`).

```sh
git clone https://github.com/mateogsilvaa/a11yfix.git
cd a11yfix
npm ci
npx playwright install chromium-headless-shell
npm run build
```

Tier 1 is optional, with either:

```sh
export ANTHROPIC_API_KEY=...                       # the built-in client
export A11YFIX_GENERATOR_CMD="ollama run qwen3:8b"  # or any model or agent CLI (same as --generator-cmd)
```

Run the CLI with `node packages/cli/dist/cli.js <command>` (or `npm run a11yfix -- <command>`), or in Docker:
`docker build -t a11yfix .` (see [docs/sandbox.md](docs/sandbox.md)).

## Usage

```sh
a11yfix audit <file.html> --out findings.json [--level 1|2]
a11yfix fix findings.json --verify --out patches/ [--strict] [--mode auto|codemod|llm] [--generator-cmd CMD] [--db FILE]
a11yfix verify <file.html> <patch.json> [--findings findings.json]
a11yfix site <url> [--depth N] [--max-pages N] [--viewports LIST] [--db FILE --incremental]
a11yfix bench --corpus ./corpus --report report.md [--mode ...] [--strict] [--compare metrics.json]
git apply patches/a11yfix.patch
```

- `--verify` is off by default for `fix` only to iterate quickly while developing; without it no `.patch` is written.
- Verifier options (`fix`, `bench`): `--no-ax`, `--no-focus`, `--visual desktop,mobile|none`,
  `--max-visual-change <percent>`, `--max-layout-shift <n>`, `--regression-impact minor|moderate|serious|critical`.
- Tier 1: `--generator-cmd`, `--generator-input text|json`, `--model` (built-in client, default `claude-opus-5-5`),
  `--effort`, `--concurrency`. `--limit N` caps findings per file.

`fix` writes `a11yfix.patch` (paths relative to the current directory, for `git apply` from the repository root) and,
per finding, `<id>.patch.json`, `<id>.verification.json` (with the accessibility-tree, focus and visual results) and
`<id>.diff`.

### The tier-1 request

One finding per request. The system prompt sets the role (senior accessibility engineer, WCAG 2.2, minimal patches, no
rewrites) and the literal rules: one violation per call; `after` fixes that one and only that one; no style changes
unless the rule requires them; for images, describe function rather than appearance, `alt=""` when decorative; never
silence a rule by hiding or deleting. The message carries axe's rule help, the node's source text and `outerHTML`,
ancestors, computed styles, the heading outline, axe's check data, the rule's guidance, and the length limits. The
built-in client uses a JSON schema as the response format and caches the file block across the findings of a page.

## Packages and the Rule API

| Package | Contents |
|---|---|
| [`a11yfix-core`](packages/core) | audit, source mapping, validation, verifier, site crawler, storage, pipeline, report, Rule API, tier-1 generators |
| [`a11yfix-rules-core`](packages/rules-core) | the core rules and their tier-0 codemods |
| [`a11yfix-cli`](packages/cli) | the `a11yfix` command |
| [`a11yfix-mcp`](packages/mcp) | the MCP server (`a11yfix-mcp`): a thin wrapper over the core |
| [`a11yfix-action`](packages/action) | the GitHub Action's logic (`action.yml` at the root); private, not published |

A rule is a typed object: `id`, `version` (semver), `axe`, `wcag`, `level`, `tier`, `confidence`, `detect`, `fix`
(the codemod), `guidance` (for tier 1), `verify` (extra checks) and `deprecated`. See the
[rule author guide](docs/rule-author-guide.md) and the [versioning and deprecation policy](docs/rule-versioning.md).

**The Rule API is still experimental** ([ADR 0006](docs/adr/0006-experimental-rule-api.md)). The verifier now covers
the accessibility tree, focus order and visual regressions, which was the main condition for opening it. What is left
before external rule packages are accepted: real contrast resolution (backgrounds up the tree, design tokens instead of
loose hex values) and a conformance suite that third-party rules must pass (phase 4).

## Benchmark

22 broken pages ([`corpus/`](corpus)): 10 hand-written pages with easy and deliberately ambiguous cases for every rule,
the 4 inaccessible "before" pages of the W3C WAI [Before and After Demonstration](https://www.w3.org/WAI/demos/bad/),
and 8 axe-core rule fixtures. Every run below uses the full verifier (axe, static checks, accessibility tree, focus
order, desktop pixels).

| Run | Fix rate | Precision | Tier 0 precision | False-fix | Regression | Report |
|---|---|---|---|---|---|---|
| Tier 0 only (no model, offline) | 20.5% | 100.0% | **100.0% (136/136)** | 0.0% | 0.0% | [bench/codemod/report.md](bench/codemod/report.md) |
| Tier 0 + tier 1 (`claude-opus-5-5`) | not run yet | | | | | [report.md](report.md) |

The offline run fixes a fifth of what it detects, and everything it fixes is right: the rest is tier 1 by design
(images, contrast, widget state) or codemods declining what they cannot prove. The [analysis](bench/codemod/report.md#analysis)
explains every category of skip and the two `heading-order` bugs the benchmark caught along the way.

The Claude run needs an API key, which the environment this was built in did not have, and this repository only
publishes measured numbers. `npm run bench` runs it and writes [report.md](report.md) with a comparison against the
offline run. Bad numbers get published too.

Engines are pinned (axe-core 4.14.1, Playwright 1.65.1) and recorded in every report: a benchmark is only comparable
with a run on the same engines.

```sh
npm run bench:codemod   # offline, ~45 s
npm run bench           # tier 0 + tier 1 with the built-in client; needs ANTHROPIC_API_KEY
npm run demo            # regenerate demo/after from demo/before
```

## Limitations

**axe-core is still the first judge, and no automated check is a person.** The accessibility-tree, focus and visual
comparisons catch what changed for users, not whether the result is good: an `alt` can be specific and still wrong
about what the image means, and a `label` can be present and confusing. "Verified" means *the violation is gone and
none of these checks found anything worse*. Review the patch before merging it.

**Patching is static HTML only.** Site mode audits rendered pages, but a finding in generated markup must be fixed in
the template or component, and a11yfix cannot find it there yet (roadmap phase 2).

**Contrast is fixed as a loose value.** Tier 1 changes a colour where the text is styled; resolving the background up
the tree and proposing a design-token change instead is roadmap phase 3 work that is not done.

**Cost and latency.** Every patch costs a browser re-audit with the extra probes (about 0.3 s per patch on the
corpus) and, in tier 1, a model call. One shared Chromium (a fresh context per audit), bounded concurrency, prompt
caching per page, tier 0 for everything mechanical, `--limit`, and incremental site runs keep this under control.

**Eight rules are patched** (`image-alt`, `label`, `heading-order`, `aria-roles`, `aria-required-attr`,
`aria-allowed-attr`, `aria-valid-attr-value`, `color-contrast`). Everything else axe finds is used to detect
regressions and is reported in site mode.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md), the [Code of Conduct](CODE_OF_CONDUCT.md),
the [architecture decisions](docs/adr) and the [roadmap](ROADMAP.md). Two rules above all: the verifier is never
weakened to improve a number, and tier 0 stays at 100% precision.

```sh
npm test               # builds, then runs every test with a real browser (includes both sabotage suites)
npm run bench:codemod  # required when you touch rules, the verifier or the pipeline
```

## License

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party corpus pages keep their own licenses (axe-core
fixtures: MPL-2.0; W3C BAD pages: W3C Software and Document License); see [corpus/README.md](corpus/README.md).
