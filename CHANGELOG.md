# Changelog

All notable changes. The project follows semver; while it is 0.x, minor versions may break the experimental Rule
API (ADR 0006).

## 0.2.0

Phase 0 of the roadmap: consolidate the core.

### Added
- **Tiered fixing.** Tier 0 deterministic codemods for `label`, `heading-order`, `aria-roles`, `aria-allowed-attr`
  and `aria-valid-attr-value`; they decline whatever needs judgment. Tier 1 (the model) handles the rest.
  `--mode auto|codemod|llm`. Reports break results down by tier; tier 0 is held to 100% precision.
- **Rule plugin API** (experimental): typed `Rule` with `detect`, `fix`, `verify`, `wcag`, `tier`, `confidence`,
  per-rule semver and deprecation; `RuleRegistry`; `defineRule` validation.
- **Packages**: `a11yfix-core`, `a11yfix-rules-core`, `a11yfix-cli` in an npm workspaces monorepo.
- **Git patch output**: `fix --verify` writes `a11yfix.patch`, applicable with `git apply`.
- **`--strict`**: leaves suspicious patches out of the output patch. Suspicious patches get their own report section.
- **Verifier**: flags content made invisible with clip/clip-path, opacity 0, font-size 0 or text-indent.
- **Sabotage test**: hundreds of deliberately fake fixes over the hand-written corpus; the verifier must reject all.
- Engine versions (a11yfix, axe-core, Playwright, Node) recorded in every report.
- Governance: CONTRIBUTING, CODE_OF_CONDUCT, GOVERNANCE, rule author guide, rule versioning policy, ADRs, issue and
  PR templates, ROADMAP.
- CI matrix: Linux, Windows, macOS × Node 20, 22, 24; offline benchmark job that fails if tier 0 drops below 100%.

### Changed
- License: MIT → Apache-2.0 (ADR 0007).
- axe-core, Playwright and all direct dependencies pinned to exact versions.
- `audit` filters through each rule's `detect`.

### Removed
- The naive heuristic generator (`--generator heuristic`), replaced by tier-0 codemods.

## 0.1.0

First prototype: audit, LLM patch generation, shape validation, verification, benchmark over a 22-page corpus.
