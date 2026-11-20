# Governance

## Roles

- **Maintainers** review and merge pull requests, cut releases, and own the verifier and the benchmark.
  Current maintainers: [@mateogsilvaa](https://github.com/mateogsilvaa).
- **Rule owners** are contributors responsible for one or more rules in `verifa11y-rules-core`. They review changes to
  those rules. A rule owner is listed in the rule's source file.
- **Contributors**: anyone who opens an issue or a pull request.

A contributor becomes a rule owner after landing a rule (or substantial changes to one) and asking to own it. A rule
owner becomes a maintainer by invitation of the existing maintainers after sustained, careful work.

## Decisions

- Day-to-day changes: one maintainer approval.
- Changes to the verifier, the Rule API, the benchmark methodology, the license, or this document: an
  [ADR](docs/adr) in the same PR and approval from every active maintainer (lazy consensus over 7 days when there
  are more than two).
- A change that lowers tier-0 precision below 100% on the corpus is not merged, whoever proposes it.

## Releases

Packages are versioned together while the project is 0.x. Releases follow semver; until 1.0, minor versions may
break the Rule API (it is experimental, see ADR 0006). Every release notes the axe-core and Playwright versions it
pins and links the benchmark report it was measured with.

## What the project will not do

- Claim or imply WCAG conformance. Reports always say that verifa11y does not guarantee it.
- Require an account, a hosted service, or telemetry.
- Route mechanical fixes through a model.
