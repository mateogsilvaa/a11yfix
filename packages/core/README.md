# verifa11y-core

The engine behind [`verifa11y`](https://www.npmjs.com/package/verifa11y): axe-core audit with exact source lines,
patch shape validation, the verifier (axe, static suspicion checks, accessibility tree, focus order, pixels), the
experimental Rule API, and the optional tier-1 generators (built-in Claude client, or any command).

Most people want the CLI (`npx verifa11y`) or the MCP server (`verifa11y-mcp`). Use this package to embed the
pipeline or to write rules; see the [rule author guide](https://github.com/mateogsilvaa/verifa11y/blob/main/docs/rule-author-guide.md). The Rule API is
experimental in 0.x ([ADR 0006](https://github.com/mateogsilvaa/verifa11y/blob/main/docs/adr/0006-experimental-rule-api.md)).

Pages render in Playwright's headless Chromium: install it once with `npx verifa11y install-browser`, or call
`installBrowser()`.

verifa11y does not guarantee WCAG conformance. Apache-2.0.
