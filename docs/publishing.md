# Publishing to npm

Four packages are published; `verifa11y-action` and the monorepo root are private.

| Package | Folder | What people install it for |
|---|---|---|
| `verifa11y-core` | `packages/core` | the engine (a dependency of the others) |
| `verifa11y-rules-core` | `packages/rules-core` | the rule set (a dependency of the CLI and MCP server) |
| `verifa11y` | `packages/cli` | the command: `npx verifa11y` |
| `verifa11y-mcp` | `packages/mcp` | the MCP server: `npx verifa11y-mcp` |

All four share one version and depend on each other at that exact version, so they are always published together,
dependencies first.

## Once

- An npm account with two-factor authentication on (npm requires 2FA to publish).
- `npm login` in this shell.

## Each release

From a clean checkout of the release tag, at the repository root:

```sh
git switch --detach v0.4.1      # the tag being released
npm ci
npm test                        # must pass
npm run build
npm publish -w packages/core
npm publish -w packages/rules-core
npm publish -w packages/cli
npm publish -w packages/mcp
```

`npm publish` runs each package's `prepack`, which copies `LICENSE` and `NOTICE` into the package and refuses to
publish a package whose `dist/` is missing or older than its `src/`. Each package publishes `dist/`, `src/` (for
source maps), its README, `LICENSE` and `NOTICE`; no tests and no corpus.

To see exactly what would be published without publishing: `npm pack -w packages/cli --dry-run`.

## Check

```sh
npm view verifa11y version
npx -y verifa11y@latest --version
npx -y verifa11y install-browser && npx -y verifa11y audit demo/before/index.html --out /tmp/findings.json
```

## If something goes wrong

- A package published by mistake can be unpublished within 72 hours (`npm unpublish <name>@<version>`), but that
  version number can never be reused. Prefer publishing a fixed patch version.
- If one package fails halfway, fix it and publish the remaining ones at the same version; do not bump only some.
