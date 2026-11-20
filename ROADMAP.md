# Roadmap

Three commitments shape everything below:

1. **Suspicious is a report section and a flag, not a work queue.** Suspicious patches are listed separately and
   `--strict` keeps them out of the output. The output is a standard `.patch` that `git apply` accepts, so it goes
   straight into a pull request. *(Done in 0.2.)*
2. **The public contract is the plugin API, not the CLI.** That is where adoption happens. It opens only when the
   verifier can hold third-party rules to account (phase 3).
3. **Telemetry, accounts and servers are optional, always.** a11yfix must work on a machine with no network beyond
   the target.

If the roadmap has to be cut: do 0, 1 and 3, and leave 2 out. Plain HTML with strong verification is more honest
than half-working codemods for templates.

## Phase 0: consolidate the core *(done in 0.2.0)*

- [x] Apache-2.0 license, NOTICE file
- [x] Tier 0: deterministic codemods for `label`, `heading-order` and mechanical ARIA; the model only for judgment;
      tiers reported separately; tier 0 at 100% precision on the corpus
- [x] Typed Rule API (`detect`, `fix`, `verify`, `wcag`, `tier`, `confidence`), per-rule semver, written deprecation
      policy; experimental until phase 3
- [x] Monorepo with workspaces: `a11yfix-core`, `a11yfix-cli`, `a11yfix-rules-core`
- [x] Real tests, including a sabotage test: the verifier must reject every deliberately fake fix
- [x] Pinned axe-core and Playwright; engine versions in every report
- [x] CONTRIBUTING, CODE_OF_CONDUCT, GOVERNANCE, rule author guide, issue and PR templates, ADRs
- [x] CI matrix (Linux, Windows, macOS × Node 20, 22, 24), lockfile installs
- [x] No telemetry, stated in the README
- [ ] `a11yfix-rules-wcag22` package (waits for phase 3, see ADR 0006)

## Phase 1: from one file to a site *(done in 0.3.0, ADR 0010)*

- [x] Crawler with depth limit, robots.txt and sitemap.xml, per-domain limits (concurrency, delay, Crawl-delay),
      deduplication by rendered-DOM hash
- [x] URL mode with real rendering: network-idle wait, viewports (mobile, tablet, desktop, custom), a capture per
      finding; findings repeated across pages grouped as template candidates
- [x] Authentication by cookies, headers and basic auth, to audit staging (sent to the target origin only)
- [x] Incremental runs: pages whose served HTML is byte-identical reuse the stored audit
- [x] Shared browser, isolated context per page, configurable concurrency
- [x] SQLite storage (`node:sqlite`): sites, pages, findings, patches, verifications, runs
- [x] Sandbox: browser-level allowlist of origins; container with pinned Node, Playwright and axe, non-root, CPU and
      memory limits, tested in CI with `--network none`
- [ ] Network-level egress restricted to the target (needs an egress proxy; documented in docs/sandbox.md, not shipped)

## Phase 2: from text patch to codemod

- AST per format: parse5/posthtml for HTML, ts-morph or jscodeshift for JSX/TSX, `@vue/compiler-sfc`, Astro's parser
- Patches as AST operations with source maps; the exact `before` is still checked, but application is structural
- Batch conflict resolution: several patches on one node or file combined coherently, with ordering and rollback
  when the set does not verify
- Framework detection by content, not extension; explicit warning for unsupported formats
- `--out-format json|patch|sarif`

## Phase 3: serious verification *(mostly done in 0.3.0, ADR 0012)*

- [x] Accessibility-tree diff before and after: role, name, states and focusability of every element, from
      Chromium's computed tree (a bad name shows up there even when axe is silent)
- [x] Visual regression per viewport with a pixel threshold outside the patched elements; layout shift measured
- [x] Focus-order assertions with real Tab presses (lost stops, reordered sequence)
- [x] Wider suspicion scoring: node removed, aria-hidden, `inert`, role=presentation, generic alt, alt equal to the
      file name, text hidden with clip-path
- [x] Configurable regression threshold (`--regression-impact`, `--max-visual-change`, `--max-layout-shift`)
- [ ] Real contrast: resolve the background up the tree, ignore image backgrounds, propose a token change (CSS
      variable, tailwind.config entry) instead of a loose hex value
- [ ] Open the Rule API to external packages (after the contrast work and the phase 4 conformance suite)

## Phase 4: rule ecosystem

- Public rule registry with metadata: WCAG criterion, tier, expected confidence, author, version
- `npm create a11yfix-rule` template and a conformance suite every external plugin must pass to be listed
- Corpus as its own versioned repository, with its own license (MIT for hand-written pages, CC-BY for adapted
  ones); breaking the corpus fails CI
- Conformance badge per plugin and per rule
- `good-first-rule` labels; the rule author guide grows with resolved ambiguous cases
- Rule proposals through issues, with acceptance criteria: determinism possible, verifiable by the loop, clear WCAG
  criterion

## Phase 5: evidence and compliance

- Reports structured after WCAG-EM and mapped to EN 301 549: methodology, sampling, date, version, corpus hash
- Fillable VPAT draft that separates what was verified from what needs human judgment
- Tamper-evident log: every run with version, commit, findings, verifications and a chained hash
- Honest wording in every report: a11yfix does not guarantee conformance

## Beyond the plan: any agent as tier 1 *(0.3.0, ADR 0011)*

- [x] `--generator-cmd`: tier 1 through any model or agent CLI (local models, coding agents, scripts), verified like
      every other patch
- [x] Documented protocol for agents that use a11yfix as their judge (`docs/agents.md`)
- [x] An MCP server (`a11yfix-mcp`, ADR 0013, MCP 2026-07-28): `rules`, `audit`, `fix`, `verify` and a
      `fix-accessibility` prompt; conformance caveat in every result
- [ ] Run the MCP server in real hosts as part of release checks (MCP Inspector, Claude Code, Claude Desktop)

## Phase 6: distribution

- [ ] SARIF output, so GitHub Code Scanning consumes it with no custom integration
- [x] Official GitHub Action: one review of verified suggestions on the changed lines, job summary for forks,
      optional failing check (ADR 0014); tagging and the Marketplace listing are still to do
- [ ] pre-commit hook
- [ ] LSP server to show findings in the editor
- [ ] Optional hosted instance, never a requirement

## Benchmark v2

- 200+ pages from real repositories, not only fixtures
- Human-annotated ground truth, double annotation, Cohen's kappa to show the labels are reliable
- Versioned corpus; public, reproducible leaderboard
- Metrics: precision and recall per tier (tier 0 at 100%), false-fix rate, regression rate, cost per fix, and the
  accepted-PR rate reported by users

## What not to do

- Do not route everything through the model. Every mechanical rule sent to a model is precision and money thrown away.
- Do not promise WCAG conformance.
- Do not add rules before the verifier covers the accessibility tree and visual regressions: coverage without
  verification is theater.
- Do not open the plugin API before the verifier is hardened, or it fills up with rules that verify nothing.
- Do not make an account, a cloud service or telemetry a requirement.

## Order and risk

| Phase | Unlocks | Risk if done early |
|---|---|---|
| 0 Consolidate | Others can contribute | none |
| 1 Sites | Use on whole projects | Cost and instability |
| 2 Codemods | Real repositories | Broken patches in templates |
| 3 Verification | Technical credibility | none |
| 4 Ecosystem | Third-party growth | Junk rules |
| 5 Evidence | Professional and legal use | Reports on a weak base |
| 6 Distribution | Passive adoption | none |
