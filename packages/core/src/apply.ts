// Patch applicator. A patch is a single exact-substring replacement:
// `before` must appear verbatim in the source and is replaced by `after`.
// Line-number prefixes, whitespace drift and paraphrased markup all fail
// here, by design: the model must quote the file, not reconstruct it.

import { createTwoFilesPatch, structuredPatch } from "diff";
import { detectEol, occurrences, toEol } from "./source.js";
import type { Patch, SourceRange } from "./types.js";

export interface AppliedPatch {
  patched: string;
  /** Offset where `before` started in the original. */
  editStart: number;
  /** End of `before` in the original (exclusive). */
  editEndOld: number;
  /** End of `after` in the patched text (exclusive). */
  editEndNew: number;
  /** Unified diff (3 lines of context) for humans. */
  diff: string;
  /** Lines touched: per hunk, max(removed, added), summed. Computed with 0 context. */
  linesTouched: number;
  hunks: number;
}

export type LocateResult =
  | { ok: true; index: number; before: string; after: string }
  | { ok: false; kind: "not_found" | "ambiguous"; reason: string };

/**
 * Find where to apply the patch. `before`/`after` are first normalized to
 * the file's line endings. When `before` occurs more than once, the
 * occurrence that overlaps the target node wins; with no overlapping
 * occurrence the patch is ambiguous and is not applied.
 */
export function locate(src: string, patch: Patch, target: SourceRange | null): LocateResult {
  const eol = detectEol(src);
  const before = toEol(patch.before, eol);
  const after = toEol(patch.after, eol);
  const hits = occurrences(src, before);
  if (hits.length === 0) {
    return { ok: false, kind: "not_found", reason: "`before` is not an exact substring of the source file" };
  }
  if (hits.length === 1) return { ok: true, index: hits[0]!, before, after };
  if (target) {
    const overlapping = hits.filter((i) => i < target.end && i + before.length > target.start);
    if (overlapping.length === 1) return { ok: true, index: overlapping[0]!, before, after };
  }
  return {
    ok: false,
    kind: "ambiguous",
    reason: `\`before\` occurs ${hits.length} times and none (or several) of the occurrences overlap the target node`,
  };
}

export function applyAt(src: string, index: number, before: string, after: string, fileName = "file.html"): AppliedPatch {
  const patched = src.slice(0, index) + after + src.slice(index + before.length);
  const tight = structuredPatch(fileName, fileName, src, patched, undefined, undefined, { context: 0 });
  let linesTouched = 0;
  for (const h of tight.hunks) linesTouched += Math.max(h.oldLines, h.newLines);
  const diff = createTwoFilesPatch(`a/${fileName}`, `b/${fileName}`, src, patched, undefined, undefined, { context: 3 });
  return {
    patched,
    editStart: index,
    editEndOld: index + before.length,
    editEndNew: index + after.length,
    diff,
    linesTouched,
    hunks: tight.hunks.length,
  };
}
