# 0011. Tier 1 through any command: the verifier, not the vendor, is the contract

## Context
Tier 1 used the Anthropic API only. People already have other models and agents (local models, coding-agent CLIs,
company gateways), and requiring one vendor's key is a reason not to try the tool. The project's value is the
verifier, not the generator.

## Decision
`--generator-cmd` runs any shell command per finding: the request goes to stdin (plain text by default, or JSON), and
a patch object is read from stdout. Output around the object is tolerated; invalid output is retried twice with the
error appended. Patches from a command are validated and verified exactly like those of the built-in client. The
built-in Anthropic client stays as the default when an API key is set and no command is given.

## Consequences
Any model or agent can produce tier-1 patches, including fully offline local models. Token usage is unknown for
commands and reported as zero; benchmark reports name the command. Command output is untrusted data: it can only
become a patch, and only a verified one reaches `verifa11y.patch` (or a suspicious one, without `--strict`).
