# a11yfix-mcp

An MCP server that lets AI agents **fix accessibility violations in static HTML files and have every fix verified**
against axe-core plus the browser's accessibility tree, focus order and rendered pixels.

**This is not an accessibility audit and it does not certify WCAG conformance.** "Verified" means axe-core no longer
reports the violation and the other checks found nothing worse. Every result says so in its payload, and agents must
not tell users a page "is accessible". The contract is in [docs/agents.md](../../docs/agents.md).

Version 0.x: the a11yfix Rule API is still experimental (ADR 0006).

- MCP revision 2026-07-28 (`@modelcontextprotocol/server` 2.4.0, pinned); 2025-era hosts still work.
- Tools: `rules`, `audit`, `fix` (writes a `git apply` patch under `<out>/<runId>/`, never edits the HTML), `verify`.
- Structured results with an output schema; the conformance caveat is in every result.
- Offline by default (`mode: "codemod"`); a model only with `mode: "auto"` and one configured in the server's
  environment.
- Files confined to `--root`, symlinks resolved, size limits.

```sh
claude mcp add a11yfix -- node /path/to/a11yfix/packages/mcp/dist/server.js --root .
```

Apache-2.0.
