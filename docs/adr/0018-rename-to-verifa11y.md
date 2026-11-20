# 0018. Rename the project to verifa11y

## Context
"a11yfix" was taken several times over by the time this project looked for adoption: the npm package `a11yfix`
belongs to an unrelated project with a near-identical pitch ("an accessibility linter that writes the patch"), and a
commercial tool and a WordPress plugin use the same name. People searching for this project would find the others,
`npx a11yfix` would run someone else's code, and the GitHub Marketplace requires a unique action name.

## Decision
The project, its packages, CLI command, environment variables and output paths are renamed `verifa11y` (verify +
a11y), in 0.4.0:

| 0.3 | 0.4 |
|---|---|
| repository `mateogsilvaa/a11yfix` | `mateogsilvaa/verifa11y` (GitHub redirects the old URL) |
| packages `a11yfix-core`, `a11yfix-rules-core`, `a11yfix-cli`, `a11yfix-mcp`, `a11yfix-action` | `verifa11y-core`, `verifa11y-rules-core`, `verifa11y-cli`, `verifa11y-mcp`, `verifa11y-action` |
| command `a11yfix`, MCP command `a11yfix-mcp` | `verifa11y`, `verifa11y-mcp` |
| `A11YFIX_*` environment variables | `VERIFA11Y_*` |
| `.a11yfix/` (MCP output), `a11yfix.patch`, `a11yfix.sqlite` | `.verifa11y/`, `verifa11y.patch`, `verifa11y.sqlite` |

The name puts the project's one differentiator in the name: it verifies every patch, including its own. `verifa11y`
was free on npm, as a GitHub account and on the Marketplace when chosen (2026-11-20).

There are no aliases for the old names. Nothing was published to npm under them, and the project is 0.x.

## Consequences
- Breaking for anyone scripting 0.3: the command, environment variables and file names change; the release notes
  list them.
- Benchmark artifacts under `bench/` produced before the rename keep their recorded engine names
  (`a11yfix-core 0.3.0`); they are the record of what ran. The next run writes the new names. Corpus pages are not
  edited, so benchmark inputs do not change.
- CHANGELOG entries for 0.1 to 0.3 keep the name they shipped with.
