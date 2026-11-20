# 0013. An MCP server: a thin, honest wrapper over the core

## Context
ADR 0011 lets any agent CLI write tier-1 patches when a11yfix drives. Agents that are already editing a project
(Claude Desktop, Claude Code, Cursor, and others) speak the Model Context Protocol and call tools more reliably than
they parse CLI output. Exposing a11yfix to agents that run unsupervised has a cost: whatever the verifier misses, an
agent repeats with confidence, and an agent summarizing "4 verified" will tell a user their page is accessible unless
the result itself says otherwise.

## Decision
A separate package, `a11yfix-mcp`, on the v2 TypeScript SDK (`@modelcontextprotocol/server`, pinned exactly, MCP
revision 2026-07-28; the SDK still serves 2025-era hosts). It is a thin wrapper: path confinement, limits, output
directories and wording live there; every decision about findings, patches and verification is the core's.

- Four tools, in a fixed order: `rules` (tiers and what each rule declines by design), `audit`, `fix`, `verify`.
  No site crawling and no benchmark over MCP.
- Structured results with output schemas. Every result carries `conformance` and `caveats`, and its text starts with
  a warning, because agents copy the first line. A test fails if that stops being true.
- `fix` takes the HTML path (it audits internally), defaults to `mode: "codemod"` (offline, reproducible) and
  `strict: true`, and writes a `git apply` patch under `<out>/<runId>/`. It never edits the input file: the user sees
  the diff and applies it. A model is used only with an explicit `mode: "auto"` and a generator configured in the
  server's environment, with a cheap default model, since the calling agent is often a model too.
- Files only inside the roots (`--root`), after resolving symlinks; `.html` only; 2 MB per file; 500 findings per
  audit. The SDK version is recorded in every result with the other engines.
- Tests: wire-level conformance (`server/discover`, `resultType`, `ttlMs`/`cacheScope`, deterministic `tools/list`,
  2025-era handshake), a snapshot of the tool schemas, a check that docs/agents.md documents every tool and parameter,
  path confinement, and the warning test.

## Consequences
Any MCP client gets a11yfix without a key and without a11yfix knowing which model it is; the verifier stays the
contract. The server is 0.x while the Rule API is experimental. Running it in a real host (MCP Inspector, Claude
Code, Claude Desktop) is still a manual step: the automated tests use the SDK client and raw JSON-RPC, which validate
what the authors believe the protocol to be.
