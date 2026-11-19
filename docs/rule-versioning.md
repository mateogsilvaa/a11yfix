# Rule IDs, versions and deprecation

## Rule IDs

- A rule ID is kebab-case and **permanent**. Once released, an ID is never reused for a different meaning, even
  after the rule is removed.
- Core rule IDs match the axe-core rule they are built on (`image-alt`, `label`, ...). Rules in other packages are
  prefixed with the package's short name when they could collide (`wcag22/target-size` is written as
  `wcag22-target-size`).
- Reports, `findings.json`, `metrics.json` and configuration refer to rules by ID, so an ID change is a breaking
  change for every user of the rule.

## Rule versions

Every rule has its own semver `version`, independent of the package version:

| Change | Bump |
|---|---|
| Fix a codemod bug, reword guidance, decline more cases | patch |
| Fix more cases (new codemod branch), add a verification check, narrow `detect` | minor |
| Change what the rule detects in a way users would notice, change the tier, rename or remove options | major |

The benchmark report prints each rule's version, so a change in a rule's numbers can always be traced to a version.

## Deprecation

1. Mark the rule with `deprecated: { since, replacedBy?, reason }`. Deprecated rules stay registered, are skipped by
   default in audits, and are listed with a warning in reports.
2. Keep a deprecated rule for at least **two minor releases** of its package (or until 1.0 for 0.x packages, at least
   one minor release) before removing it.
3. Removal is a major change of the rule package. The ID is retired, not reused.
4. The CHANGELOG lists every deprecation and removal with the replacement, if any.
