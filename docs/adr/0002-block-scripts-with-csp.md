# 0002. Block page scripts with CSP, not by disabling JavaScript

## Context
v1 patches static HTML, so the audited DOM must be the DOM the source describes; page scripts would make them
diverge. Disabling JavaScript in the browser context stops timers, and `axe.run()` never resolves.

## Decision
Serve every page with `Content-Security-Policy: script-src 'none'`. Page scripts and inline handlers are blocked;
axe and our own code are injected over the DevTools protocol, which CSP does not govern. Pages are served from a fake
origin through request interception: the page from memory, relative resources from the original directory, every
other origin blocked.

## Consequences
Audits are offline and deterministic, and patched copies render exactly like the original without being written next
to it. `<noscript>` is parsed as raw text (scripting is enabled), and parse5 is configured the same way. Pages that
need their scripts to render are out of scope until URL mode (roadmap phase 1).
