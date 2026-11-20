// Which lines of the PR head a review comment may sit on.
//
// GitHub only accepts review comments on lines that appear in the pull
// request's diff: on the RIGHT side, every line of a hunk's new range
// (added or context). A multi-line comment must start and end in the same
// hunk. The `patch` field of the "list pull request files" endpoint is that
// diff; it is missing for binary files and very large diffs.

export interface LineRange {
  /** 1-based, inclusive. */
  start: number;
  end: number;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** New-side line ranges of every hunk in a unified diff. */
export function rightHunks(patch: string): LineRange[] {
  const out: LineRange[] = [];
  for (const line of patch.split("\n")) {
    const m = HUNK.exec(line);
    if (!m) continue;
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    if (count > 0) out.push({ start, end: start + count - 1 });
  }
  return out;
}

/** The hunk that contains every line from `start` to `end`, if any. */
export function hunkFor(hunks: LineRange[], start: number, end: number): LineRange | undefined {
  return hunks.find((h) => h.start <= start && end <= h.end);
}
