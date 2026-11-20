// The words of the pull-request review: one comment per suggestion, a body
// that accounts for every finding, and the job summary used when the token
// cannot write (fork pull requests). Every comment and the body carry the
// same caveats as the MCP server, verbatim: a reviewer who sees one comment
// must not conclude more than was verified.

import { createHash } from "node:crypto";
import { CAVEATS, CONFORMANCE, WARNING, type VerificationStatus } from "verifa11y-core";
import { placeFixes, type FileReport, type FindingResult, type Suggestion, type Unplaced } from "./suggest.js";

export const REVIEW_MARKER = "<!-- verifa11y:review";
export const SUGGESTION_MARKER = "<!-- verifa11y:suggestion";

export interface RunInfo {
  mode: string;
  strict: boolean;
  /** verifa11y version that produced the results. */
  version: string;
  /** Name of the tier-1 generator, or null (codemods only). */
  generator: string | null;
  /** Changed HTML files left out because of max-files. */
  notAudited: string[];
}

export interface ReviewComment {
  path: string;
  line: number;
  start_line?: number;
  side: "RIGHT";
  start_side?: "RIGHT";
  body: string;
}

export interface Counts {
  files: number;
  findings: number;
  verified: number;
  suggested: number;
  verifiedElsewhere: number;
  suspicious: number;
  rejected: number;
  skipped: number;
  errors: number;
  /** Findings without a verified fix, plus files that could not be audited. */
  unfixed: number;
}

export interface ReviewPlan {
  suggestions: Suggestion[];
  unplaced: Unplaced[];
  comments: ReviewComment[];
  body: string;
  /** Markdown for $GITHUB_STEP_SUMMARY: the body plus every suggestion as a diff. */
  summary: string;
  counts: Counts;
  /** Hash of what the review says; an identical review is not posted twice. */
  digest: string;
}

export interface ReviewPayload {
  commit_id: string;
  event: "COMMENT";
  body: string;
  comments: ReviewComment[];
}

const MAX_LIST = 40;
const MAX_BODY = 60_000;

/** A fence longer than any backtick run inside the text. */
export function fenceFor(text: string): string {
  const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  return "`".repeat(Math.max(3, longest + 1));
}

/** Keep text from findings and generators inert on one line: no HTML, no @mentions. */
const inline = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"))
    .replace(/@(?=\w)/g, "@​")
    .trim();

const caveatList = () => CAVEATS.map((c) => `- ${c}`).join("\n");

function describeFix(r: FindingResult): string {
  const f = r.finding;
  const wcag = f.wcag.length ? ` (WCAG ${f.wcag.join(", ")})` : "";
  const impact = f.impact ? `, ${f.impact}` : "";
  const tier = r.tier === 0 ? "tier 0 codemod" : r.tier === 1 ? "tier 1 generator" : "no patch";
  const conf = r.patch ? `, confidence ${r.patch.confidence}` : "";
  return `\`${f.ruleId}\`${wcag}${impact}, finding \`${f.id}\`: ${inline(f.help)}. Fix by ${tier}${conf}: ${inline(r.patch?.rationale)}`;
}

function where(path: string, line: number | null | undefined): string {
  return line ? `\`${path}:${line}\`` : `\`${path}\``;
}

export function commentBody(s: Suggestion): string {
  const fence = fenceFor(s.replacement);
  const fixes = s.fixes.map((r) => `- ${describeFix(r)}`).join("\n");
  return [
    `${SUGGESTION_MARKER} ${s.key} -->`,
    `**verifa11y: verified fix${s.fixes.length > 1 ? `es (${s.fixes.length}, combined because they touch the same lines)` : ""}.** Review it before you commit it.`,
    "",
    fixes,
    "",
    `${fence}suggestion`,
    ...(s.replacement === "" ? [] : [s.replacement]),
    fence,
    "",
    `> ${WARNING}`,
    "",
    "<details><summary>What was verified, and what was not</summary>",
    "",
    caveatList(),
    "",
    "</details>",
  ].join("\n");
}

function toComment(s: Suggestion): ReviewComment {
  const c: ReviewComment = { path: s.path, line: s.endLine, side: "RIGHT", body: commentBody(s) };
  if (s.startLine !== s.endLine) {
    c.start_line = s.startLine;
    c.start_side = "RIGHT";
  }
  return c;
}

function capped<T>(items: T[], render: (x: T) => string): string[] {
  const out = items.slice(0, MAX_LIST).map(render);
  if (items.length > MAX_LIST) out.push(`- … and ${items.length - MAX_LIST} more (see results.json in the job)`);
  return out;
}

const REJECTED: VerificationStatus[] = ["rejected_persists", "rejected_regression", "rejected_invalid", "rejected_apply_failed"];

export function planReview(files: FileReport[], run: RunInfo): ReviewPlan {
  const suggestions: Suggestion[] = [];
  const unplaced: Unplaced[] = [];
  for (const f of files) {
    if (f.error) continue;
    const p = placeFixes(f);
    suggestions.push(...p.suggestions);
    unplaced.push(...p.unplaced);
  }
  const all = files.flatMap((f) => f.results.map((r) => ({ path: f.path, r })));
  const by = (st: VerificationStatus[]) => all.filter((x) => st.includes(x.r.status));
  const suspicious = by(["rejected_suspicious"]);
  const rejected = by(REJECTED);
  const skipped = by(["skipped"]);
  const errors = files.filter((f) => f.error);
  const verified = by(["verified"]).length;

  const counts: Counts = {
    files: files.length,
    findings: all.length,
    verified,
    suggested: suggestions.reduce((n, s) => n + s.fixes.length, 0),
    verifiedElsewhere: unplaced.length,
    suspicious: suspicious.length,
    rejected: rejected.length,
    skipped: skipped.length,
    errors: errors.length + run.notAudited.length,
    unfixed: all.length - verified + errors.length + run.notAudited.length,
  };

  const comments = suggestions.map(toComment);
  const line = (x: { path: string; r: FindingResult }) =>
    `- ${where(x.path, x.r.finding.sourceLines?.start)} \`${x.r.finding.ruleId}\` \`${x.r.finding.id}\`: ${inline(x.r.reason) || "no reason recorded"}`;

  const sections: string[] = [];
  if (unplaced.length) {
    sections.push(
      `#### Verified, but not suggested inline (${unplaced.length})`,
      "",
      "These fixes passed the verifier. They are in the job's `verifa11y.patch` (apply with `git apply`), not suggested here, because:",
      "",
      ...capped(unplaced, (u) => {
        const d = u.diff ? `\n\n  <details><summary>diff</summary>\n\n  ${fenceFor(u.diff)}diff\n${u.diff.trimEnd().split("\n").map((l) => `  ${l}`).join("\n")}\n  ${fenceFor(u.diff)}\n\n  </details>` : "";
        return `- ${where(u.path, u.line)} \`${u.fix.finding.ruleId}\` \`${u.fix.finding.id}\`: ${u.why}.${d}`;
      }),
      "",
    );
  }
  if (suspicious.length) {
    sections.push(
      `#### Suspicious: need a human (${suspicious.length})`,
      "",
      "The violation went away, but the patch looks like it hides the problem instead of fixing it. Never suggested.",
      "",
      ...capped(suspicious, line),
      "",
    );
  }
  if (rejected.length) {
    sections.push(`#### Rejected by the verifier (${rejected.length})`, "", ...capped(rejected, line), "");
  }
  if (skipped.length) {
    sections.push(`#### Skipped: need a human (${skipped.length})`, "", ...capped(skipped, line), "");
  }
  if (errors.length || run.notAudited.length) {
    sections.push(
      `#### Not audited (${errors.length + run.notAudited.length})`,
      "",
      ...capped(errors, (f) => `- \`${f.path}\`: ${inline(f.error)}`),
      ...capped(run.notAudited, (p) => `- \`${p}\`: over the \`max-files\` limit`),
      "",
    );
  }

  const tier1 = run.generator ? `, tier 1 through \`${inline(run.generator)}\`` : ", codemods only (no model)";
  const intro =
    counts.findings === 0 && counts.errors === 0
      ? `verifa11y found no violations of the rules it checks in the ${files.length} changed HTML file(s). That is not a review of the rest of WCAG.`
      : `verifa11y audited ${files.length} changed HTML file(s) (mode \`${run.mode}\`${tier1}${run.strict ? ", strict" : ""}). Only patches the verifier accepted are suggested; suspicious ones never are.`;

  const content = [
    "### verifa11y accessibility review",
    "",
    `> ${WARNING}`,
    "",
    intro,
    "",
    "| Result | Findings |",
    "|---|---:|",
    `| Found | ${counts.findings} |`,
    `| Verified and suggested inline | ${counts.suggested} |`,
    `| Verified, in the patch only | ${counts.verifiedElsewhere} |`,
    `| Suspicious: need a human, never suggested | ${counts.suspicious} |`,
    `| Rejected by the verifier | ${counts.rejected} |`,
    `| Skipped: need a human | ${counts.skipped} |`,
    "",
    ...sections,
    "#### What was verified, and what was not",
    "",
    caveatList(),
    "",
    `<sub>verifa11y ${inline(run.version)}: ${CONFORMANCE}. A person must review every suggestion before it is committed.</sub>`,
  ].join("\n");

  const digest = createHash("sha256")
    .update(content)
    .update(suggestions.map((s) => s.key).join(","))
    .digest("hex")
    .slice(0, 16);
  let body = `${REVIEW_MARKER} ${digest} -->\n${content}`;
  if (body.length > MAX_BODY) {
    body = `${body.slice(0, MAX_BODY - 200)}\n\n… (truncated: the full report is in the job summary and results.json)`;
  }

  const summary = [
    content,
    ...(suggestions.length
      ? [
          "",
          `#### Suggestions (${suggestions.length})`,
          "",
          ...suggestions.map((s) => {
            const d = [...s.original.split("\n").map((l) => `-${l}`), ...(s.replacement === "" ? [] : s.replacement.split("\n").map((l) => `+${l}`))].join("\n");
            const f = fenceFor(d);
            return `${where(s.path, s.startLine)}${s.endLine !== s.startLine ? ` to line ${s.endLine}` : ""}\n\n${s.fixes.map((r) => `- ${describeFix(r)}`).join("\n")}\n\n${f}diff\n${d}\n${f}\n`;
          }),
        ]
      : []),
  ].join("\n");

  return { suggestions, unplaced, comments, body, summary, counts, digest };
}

export function reviewPayload(plan: ReviewPlan, commitId: string): ReviewPayload {
  return { commit_id: commitId, event: "COMMENT", body: plan.body, comments: plan.comments };
}

/** Same review with the suggestions moved into the body, for when GitHub rejects inline comments. */
export function bodyOnlyPayload(plan: ReviewPlan, commitId: string): ReviewPayload {
  const extra = plan.suggestions.length
    ? `\n\n#### Suggestions GitHub would not accept inline (${plan.suggestions.length})\n\n${plan.summary.split(/#### Suggestions \(\d+\)\n\n/)[1] ?? ""}`
    : "";
  const body = `${plan.body}${extra}`;
  return { commit_id: commitId, event: "COMMENT", body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 100)}\n\n… (truncated)` : body, comments: [] };
}
