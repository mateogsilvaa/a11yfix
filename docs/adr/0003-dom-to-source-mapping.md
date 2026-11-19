# 0003. Map DOM nodes to source with parse5 element paths

## Context
axe reports DOM nodes; patches must change bytes on disk. The browser's `outerHTML` is a re-serialization, not the
source text, so it cannot be used as the `before` of a patch.

## Decision
For each violating node, the browser computes its element path (child-element indexes from `<html>`). The same path
is walked in a parse5 tree built with source locations. parse5 implements the WHATWG parsing algorithm, so for
static pages both trees match. Findings carry exact `sourceLines`, `sourceRange` and the element's real source text.

## Consequences
Prompts and codemods work on exact source text, and the verifier can key violations by source offset to tell "same
node" from "new node" across an edit. Templated sources (JSX, Vue, Astro) need a different mapping (roadmap phase 2).
