// Standard patch output: a unified diff with git headers, applicable with
// `git apply` (or `patch -p1`) from the directory the paths are relative to.

import path from "node:path";
import { structuredPatch } from "diff";

export interface FileChange {
  /** Path as it should appear in the patch, relative to the repository root. */
  path: string;
  before: string;
  after: string;
}

export function toPatchPath(file: string, root = process.cwd()): string {
  return path.relative(root, path.resolve(file)).split(path.sep).join("/");
}

/** One git-style patch covering every changed file. Unchanged files are skipped. */
export function gitPatch(changes: FileChange[], context = 3): string {
  const out: string[] = [];
  for (const c of changes) {
    if (c.before === c.after) continue;
    const p = structuredPatch(`a/${c.path}`, `b/${c.path}`, c.before, c.after, undefined, undefined, { context });
    out.push(`diff --git a/${c.path} b/${c.path}`);
    out.push(`--- a/${c.path}`);
    out.push(`+++ b/${c.path}`);
    for (const h of p.hunks) {
      out.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`);
      out.push(...h.lines);
    }
  }
  return out.length ? `${out.join("\n")}\n` : "";
}
