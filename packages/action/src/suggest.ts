// Turn verified patches into GitHub suggestions on exact lines.
//
// A GitHub suggestion replaces whole lines of the PR head, and can only sit
// on lines that the pull request's diff shows (one hunk). A patch is an
// exact-substring edit, so each one is re-located with the core validator
// (the same code that placed it during verification), shrunk to the lines
// it really changes, and then:
//   - fixes whose edits overlap are not both suggested: the second one is
//     reported (apply the first, run again), as `combine` does for the patch;
//   - fixes that share a line become one suggestion, so applying them as a
//     batch cannot conflict;
//   - a suggestion outside the diff, or one GitHub cannot express (it joins
//     a line with the next), is reported in the review body with its diff.
// Nothing here talks to the network; the test feeds it a known patch.

import { createHash } from "node:crypto";
import { gitPatch, subEdits, validatePatch, type Finding, type Patch, type VerificationStatus } from "a11yfix-core";
import { hunkFor, type LineRange } from "./diff.js";

export interface FindingResult {
  finding: Finding;
  status: VerificationStatus;
  reason: string | null;
  /** 0 = codemod, 1 = generator; null when nothing was generated. */
  tier: 0 | 1 | null;
  patch: Patch | null;
}

export interface FileReport {
  /** Repository-relative, forward slashes: the path GitHub knows. */
  path: string;
  /** The file at the pull request head. */
  src: string;
  /** Commentable new-side line ranges; null when GitHub returned no diff for the file. */
  hunks: LineRange[] | null;
  results: FindingResult[];
  /** Set when the file could not be audited or fixed. */
  error?: string;
}

export interface Suggestion {
  path: string;
  /** 1-based, inclusive, in the PR head. */
  startLine: number;
  endLine: number;
  /** The lines being replaced, LF line endings, no final newline. */
  original: string;
  replacement: string;
  fixes: FindingResult[];
  /** Content hash: the same suggestion is never posted twice. */
  key: string;
}

export interface Unplaced {
  path: string;
  fix: FindingResult;
  line: number | null;
  why: string;
  /** `git apply` diff of this fix alone; empty when it no longer applies. */
  diff: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

interface Located {
  fix: FindingResult;
  edits: Edit[];
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

/** Offsets where each line starts (a final newline does not start a line). */
export function lineStarts(src: string): number[] {
  const out = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n" && i + 1 < src.length) out.push(i + 1);
  return out;
}

function lineOf(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

const overlaps = (a: Edit, b: Edit) =>
  (a.start < b.end && b.start < a.end) || (a.start === a.end && b.start === b.end && a.start === b.start);

function applyEdits(text: string, edits: Edit[], offset = 0): string {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start - offset) + e.text + out.slice(e.end - offset);
  }
  return out;
}

const lf = (s: string) => s.replace(/\r\n/g, "\n");

export function suggestionKey(path: string, original: string, replacement: string): string {
  return createHash("sha256").update(`${path}\0${original}\0${replacement}`).digest("hex").slice(0, 16);
}

/** Place every verified fix of one file: as a suggestion when GitHub allows it, otherwise in the report. */
export function placeFixes(file: FileReport): { suggestions: Suggestion[]; unplaced: Unplaced[] } {
  const { src } = file;
  const starts = lineStarts(src);
  const unplaced: Unplaced[] = [];
  const diffOf = (edits: Edit[]) => gitPatch([{ path: file.path, before: src, after: applyEdits(src, edits) }]);

  const located: Located[] = [];
  for (const fix of file.results) {
    if (fix.status !== "verified" || !fix.patch) continue;
    const v = validatePatch(src, fix.finding, fix.patch);
    if (!v.ok) {
      unplaced.push({ path: file.path, fix, line: fix.finding.sourceLines?.start ?? null, why: `the patch no longer applies (${v.reason})`, diff: "" });
      continue;
    }
    const a = v.applied;
    const edits = subEdits(src, a.editStart, a.editEndOld, a.patched.slice(a.editStart, a.editEndNew));
    if (edits.length === 0) continue;
    const start = Math.min(...edits.map((e) => e.start));
    const end = Math.max(...edits.map((e) => e.end));
    const startLine = lineOf(starts, start);
    located.push({ fix, edits, start, end, startLine, endLine: end > start ? lineOf(starts, end - 1) : startLine });
  }

  // Overlapping edits: the first (in file order) wins, as in `combine`.
  located.sort((a, b) => a.start - b.start || a.end - b.end);
  const taken: Edit[] = [];
  const accepted: Located[] = [];
  for (const l of located) {
    if (l.edits.some((e) => taken.some((t) => overlaps(e, t)))) {
      unplaced.push({
        path: file.path,
        fix: l.fix,
        line: l.startLine,
        why: "it edits the same code as another verified fix; apply that one and run a11yfix again",
        diff: diffOf(l.edits),
      });
      continue;
    }
    taken.push(...l.edits);
    accepted.push(l);
  }

  // Fixes that touch a common line become one suggestion.
  const clusters: Located[][] = [];
  for (const l of accepted.sort((a, b) => a.startLine - b.startLine)) {
    const last = clusters.at(-1);
    const lastEnd = last ? Math.max(...last.map((x) => x.endLine)) : 0;
    if (last && l.startLine <= lastEnd) last.push(l);
    else clusters.push([l]);
  }

  const suggestions: Suggestion[] = [];
  for (const cluster of clusters) {
    const startLine = Math.min(...cluster.map((l) => l.startLine));
    const endLine = Math.max(...cluster.map((l) => l.endLine));
    const edits = cluster.flatMap((l) => l.edits);
    const away = (why: string) => {
      for (const l of cluster) unplaced.push({ path: file.path, fix: l.fix, line: l.startLine, why, diff: diffOf(l.edits) });
    };

    const regionStart = starts[startLine - 1]!;
    const regionEnd = endLine < starts.length ? starts[endLine]! : src.length;
    const before = src.slice(regionStart, regionEnd);
    const after = applyEdits(before, edits, regionStart);
    const eol = /\r?\n$/.exec(before)?.[0] ?? "";
    if (eol && !after.endsWith("\n")) {
      away("it joins a line with the next one, which a GitHub suggestion cannot express");
      continue;
    }
    if (!file.hunks) {
      away("GitHub returned no diff for this file (too large or binary), so there are no lines to comment on");
      continue;
    }
    if (!hunkFor(file.hunks, startLine, endLine)) {
      away(`line${startLine === endLine ? ` ${startLine} is` : `s ${startLine}-${endLine} are`} outside the lines this pull request changes`);
      continue;
    }
    const original = lf(eol ? before.slice(0, -eol.length) : before);
    const replacement = lf(eol ? after.replace(/\r?\n$/, "") : after);
    suggestions.push({
      path: file.path,
      startLine,
      endLine,
      original,
      replacement,
      fixes: cluster.map((l) => l.fix),
      key: suggestionKey(file.path, original, replacement),
    });
  }
  return { suggestions, unplaced };
}
