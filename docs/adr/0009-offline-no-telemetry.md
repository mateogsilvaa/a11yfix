# 0009. No telemetry; no network beyond the target and the optional model

## Context
Accessibility tooling runs on staging sites, intranets and customer code. Anything that phones home is a reason not
to adopt it.

## Decision
verifa11y collects no telemetry and needs no account. Audits block every request outside the page's own origin. The
only outbound connection is the model API, and only when tier 1 is enabled with credentials. A hosted service, if it
ever exists, is optional.

## Consequences
`--mode codemod` is fully offline. Features that need network access (crawling, URL mode) are opt-in and limited to
the target.
