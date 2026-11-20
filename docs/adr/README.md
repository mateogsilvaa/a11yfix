# Architecture decision records

Short records of decisions that shape a11yfix, in the format: context, decision, consequences.
A decision is changed by a new ADR that supersedes the old one, never by editing it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-verify-every-patch.md) | Every patch is verified by re-auditing a patched copy | Accepted |
| [0002](0002-block-scripts-with-csp.md) | Block page scripts with CSP, not by disabling JavaScript | Accepted |
| [0003](0003-dom-to-source-mapping.md) | Map DOM nodes to source with parse5 element paths | Accepted |
| [0004](0004-regressions-over-full-wcag-set.md) | Check regressions against every WCAG 2.x A/AA rule | Accepted |
| [0005](0005-tiered-fixing.md) | Deterministic codemods first; the model only for judgment | Accepted |
| [0006](0006-experimental-rule-api.md) | The Rule API stays experimental until the verifier is hardened | Accepted |
| [0007](0007-apache-2-license.md) | License under Apache-2.0 | Accepted |
| [0008](0008-suspicious-and-patch-output.md) | Suspicious patches: report section and `--strict`; output a git patch | Accepted |
| [0009](0009-offline-no-telemetry.md) | No telemetry; no network beyond the target and the optional model | Accepted |
| [0010](0010-site-mode-audits-only.md) | Site mode renders for real and only audits | Accepted |
| [0011](0011-any-agent-as-tier-1.md) | Tier 1 through any command: the verifier, not the vendor, is the contract | Accepted |
| [0012](0012-verification-beyond-axe.md) | Verification beyond axe: accessibility tree, focus order, pixels | Accepted |
| [0013](0013-mcp-server.md) | An MCP server: a thin, honest wrapper over the core | Accepted |
| [0014](0014-naive-baseline-and-verifier-ablation.md) | A naive baseline and a per-layer view of the verifier | Accepted |
| [0015](0015-identifier-labels-and-dangling-id-references.md) | Suspicious: labels that restate an identifier, id references to nothing | Accepted |
| [0016](0016-github-action.md) | A GitHub Action that suggests only verified fixes, on the lines they change | Accepted |
| [0017](0017-held-out-eval-corpus.md) | A held-out eval corpus, reported apart from dev | Accepted |
