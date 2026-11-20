# 0010. Site mode renders for real and only audits

## Context
Phase 1 takes verifa11y from one file to a whole site. A live page runs scripts, depends on the network, and has no
source file: what the browser renders may come from templates, a CMS or client-side code.

## Decision
`verifa11y site` crawls the start URL's origin (depth and page limits, robots.txt, sitemap.xml), renders each page with
scripts on and waits for network idle, audits it in one or more viewports, and reports. It does not patch: patches need
a source file, and guessing one from rendered HTML would produce patches nobody can apply.

Pages are deduplicated by a hash of the rendered DOM, and findings with the same rule and markup on several pages are
grouped, because on a real site most issues come from one template. The browser may load only the target origin and
explicitly allowed origins; authentication is sent to the target only.

Storage is SQLite through `node:sqlite` (built into Node 22.13+, no native add-on to compile on every platform), and
optional. Incremental runs compare a hash of the served HTML with the stored one and reuse the stored audit when it
is byte-identical and the engines, rules and viewports are the same.

## Consequences
Site mode answers "where are the problems and which ones repeat", file mode answers "here is the verified fix".
Connecting the two (mapping a rendered finding back to a template) is roadmap phase 2. Incremental runs miss changes
that arrive only through scripts or APIs; the report says so. `--db` does not work on Node 20; everything else does.
