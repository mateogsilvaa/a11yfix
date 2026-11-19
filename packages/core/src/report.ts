// Benchmark metrics and the report.md renderer.
//
// Definitions (also printed in the report):
//   detected     = subset violations found by the auditor
//   skipped      = no patch attempted (codemod declined, no model configured)
//   proposed     = a well-formed patch was produced (by a codemod or the model)
//   applied      = proposed patches that passed shape validation and were re-audited
//   verified     = applied patches that removed the violation, added none, and were not suspicious
//   fix rate     = verified / detected
//   precision    = verified / proposed
//   false-fix    = suspicious / (verified + suspicious)   (share of axe-passing patches that only silenced axe)
//   regression   = rejected_regression / applied

import path from "node:path";
import { estimateUsd } from "./llm.js";
import type { PageOutcome, PatchOutcome } from "./pipeline.js";
import type { Rule } from "./rule.js";
import { ZERO_USAGE, addUsage, type Usage, type VerificationStatus } from "./types.js";

export interface Metrics {
  detected: number;
  skipped: number;
  proposed: number;
  applied: number;
  verified: number;
  suspicious: number;
  regression: number;
  persists: number;
  invalid: number;
  applyFailed: number;
  generationFailed: number;
  usage: Usage;
}

const APPLIED: VerificationStatus[] = ["verified", "rejected_persists", "rejected_regression", "rejected_suspicious"];

export function metricsOf(outcomes: PatchOutcome[]): Metrics {
  const st = (s: VerificationStatus) => outcomes.filter((o) => o.verification.status === s).length;
  return {
    detected: outcomes.length,
    skipped: st("skipped"),
    proposed: outcomes.filter((o) => o.generation.patch !== null).length,
    applied: outcomes.filter((o) => APPLIED.includes(o.verification.status)).length,
    verified: st("verified"),
    suspicious: st("rejected_suspicious"),
    regression: st("rejected_regression"),
    persists: st("rejected_persists"),
    invalid: outcomes.filter((o) => o.generation.patch !== null && o.verification.status === "rejected_invalid").length,
    applyFailed: st("rejected_apply_failed"),
    generationFailed: outcomes.filter((o) => o.generation.patch === null && o.verification.status === "rejected_invalid").length,
    usage: outcomes.reduce((u, o) => addUsage(u, o.generation.usage), ZERO_USAGE),
  };
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const tokens = (u: Usage) => u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
const fmtInt = (n: number) => n.toLocaleString("en-US");
const cell = (s: string | null | undefined, max = 220) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, max);

const tierOf = (o: PatchOutcome): 0 | 1 | null => (o.generation.patch ? o.generation.tier : null);

export interface ReportInput {
  generator: string;
  mode: string;
  strict: boolean;
  model: string | null;
  corpus: string;
  rules: Rule[];
  pages: PageOutcome[];
  versions: Record<string, string>;
  wallMs: number;
  date: string;
  notes?: string;
  /** Metrics of another run to compare against. */
  compare?: MetricsFile;
}

/** Machine-readable metrics written next to every report (used for comparisons). */
export interface MetricsFile {
  generator: string;
  date: string;
  pages: number;
  versions: Record<string, string>;
  overall: Metrics;
  byTier: { "0": Metrics; "1": Metrics };
  byRule: Record<string, Metrics>;
}

export function metricsFile(r: ReportInput): MetricsFile {
  const all = r.pages.flatMap((p) => p.outcomes);
  const byRule: Record<string, Metrics> = {};
  for (const rule of r.rules) {
    const o = all.filter((x) => x.finding.ruleId === rule.axe);
    if (o.length) byRule[rule.id] = metricsOf(o);
  }
  return {
    generator: r.generator,
    date: r.date,
    pages: r.pages.length,
    versions: r.versions,
    overall: metricsOf(all),
    byTier: { "0": metricsOf(all.filter((o) => tierOf(o) === 0)), "1": metricsOf(all.filter((o) => tierOf(o) === 1)) },
    byRule,
  };
}

export function renderReport(r: ReportInput): string {
  const all = r.pages.flatMap((p) => p.outcomes);
  const m = metricsOf(all);
  const t0 = metricsOf(all.filter((o) => tierOf(o) === 0));
  const t1 = metricsOf(all.filter((o) => tierOf(o) === 1));
  const totalTokens = tokens(m.usage);
  const usd = r.model ? estimateUsd(r.model, m.usage) : null;
  const avgPageMs = r.pages.reduce((s, p) => s + p.ms, 0) / Math.max(1, r.pages.length);
  const remaining = r.pages.reduce((s, p) => s + (p.remaining?.length ?? 0), 0);
  const allBefore = r.pages.reduce((s, p) => s + p.allBefore, 0);
  const allAfter = r.pages.reduce((s, p) => s + (p.allAfter ?? 0), 0);

  const L: string[] = [];
  L.push(`# a11yfix benchmark report`);
  L.push("");
  L.push(`- Mode: \`${r.mode}\` (${r.generator})${r.strict ? ", strict" : ""}`);
  L.push(`- Corpus: \`${r.corpus}\` (${r.pages.length} pages)`);
  L.push(`- Engines: ${Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  L.push(`- Run ${r.date}, total wall time ${(r.wallMs / 1000).toFixed(1)} s`);
  L.push("");
  L.push(`> a11yfix does not guarantee WCAG conformance. "Verified" means axe-core no longer reports the violation and nothing else broke; it is not a human review.`);
  L.push("");
  L.push(`## Summary`);
  L.push("");
  L.push(`| Metric | Value |`);
  L.push(`|---|---|`);
  L.push(`| Pages | ${r.pages.length} |`);
  L.push(`| Violations detected | ${m.detected} |`);
  L.push(`| Skipped (needs judgment, no model in this run) | ${m.skipped} |`);
  L.push(`| Patches proposed | ${m.proposed} |`);
  L.push(`| Patches verified | ${m.verified} |`);
  L.push(`| **Fix rate** (verified / detected) | **${pct(m.verified, m.detected)}** |`);
  L.push(`| **Precision** (verified / proposed) | **${pct(m.verified, m.proposed)}** |`);
  L.push(`| False-fix rate (suspicious / (verified + suspicious)) | ${pct(m.suspicious, m.verified + m.suspicious)} |`);
  L.push(`| Regression rate (regressions / applied) | ${pct(m.regression, m.applied)} |`);
  L.push(
    `| Mean cost per verified fix | ${m.verified ? `${fmtInt(Math.round(totalTokens / m.verified))} tokens` : "n/a"}${
      usd !== null && m.verified ? ` (~$${(usd / m.verified).toFixed(4)})` : ""
    } |`,
  );
  L.push(`| Total tokens | ${fmtInt(totalTokens)}${usd !== null ? ` (~$${usd.toFixed(2)})` : ""} |`);
  L.push(`| Mean time per page | ${(avgPageMs / 1000).toFixed(1)} s |`);
  L.push(`| Subset violations left after applying the output patch | ${remaining} of ${m.detected} |`);
  L.push(`| WCAG A/AA violations (all rules) before → after | ${allBefore} → ${allAfter} |`);
  L.push("");

  L.push(`## By tier`);
  L.push("");
  L.push(`Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.`);
  L.push("");
  L.push(`| Tier | Proposed | Verified | Precision | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |`);
  L.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const [name, t] of [["0 (codemod)", t0], ["1 (model)", t1]] as const) {
    L.push(
      `| ${name} | ${t.proposed} | ${t.verified} | **${pct(t.verified, t.proposed)}** | ${t.suspicious} | ${t.regression} | ${t.persists} | ${t.invalid + t.applyFailed} | ${
        t.verified ? fmtInt(Math.round(tokens(t.usage) / t.verified)) : "n/a"
      } |`,
    );
  }
  L.push("");

  if (r.compare) {
    const b = r.compare.overall;
    L.push(`## Compared with \`${r.compare.generator}\` (${r.compare.date})`);
    L.push("");
    L.push(`| Metric | This run | ${r.compare.generator} |`);
    L.push(`|---|---|---|`);
    L.push(`| Fix rate | ${pct(m.verified, m.detected)} | ${pct(b.verified, b.detected)} |`);
    L.push(`| Precision | ${pct(m.verified, m.proposed)} | ${pct(b.verified, b.proposed)} |`);
    L.push(`| False-fix rate | ${pct(m.suspicious, m.verified + m.suspicious)} | ${pct(b.suspicious, b.verified + b.suspicious)} |`);
    L.push(`| Regression rate | ${pct(m.regression, m.applied)} | ${pct(b.regression, b.applied)} |`);
    L.push("");
  }

  L.push(`## Outcomes`);
  L.push("");
  L.push(`| Status | Count |`);
  L.push(`|---|---|`);
  L.push(`| verified | ${m.verified} |`);
  L.push(`| rejected_suspicious (see below; in the output patch unless --strict) | ${m.suspicious} |`);
  L.push(`| rejected_persists | ${m.persists} |`);
  L.push(`| rejected_regression | ${m.regression} |`);
  L.push(`| rejected_invalid (bad patch shape) | ${m.invalid} |`);
  L.push(`| rejected_invalid (no usable model output) | ${m.generationFailed} |`);
  L.push(`| rejected_apply_failed | ${m.applyFailed} |`);
  L.push(`| skipped | ${m.skipped} |`);
  L.push("");

  L.push(`## By rule`);
  L.push("");
  L.push(`| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision | False-fix | Regression |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const rule of r.rules) {
    const o = all.filter((x) => x.finding.ruleId === rule.axe);
    if (!o.length) continue;
    const rm = metricsOf(o);
    L.push(
      `| ${rule.id} | ${rule.version} | ${rule.tier} | ${rm.detected} | ${rm.skipped} | ${rm.proposed} | ${rm.verified} | ${pct(rm.verified, rm.detected)} | ${pct(
        rm.verified,
        rm.proposed,
      )} | ${pct(rm.suspicious, rm.verified + rm.suspicious)} | ${pct(rm.regression, rm.applied)} |`,
    );
  }
  L.push("");

  L.push(`## By page`);
  L.push("");
  L.push(`| Page | Detected | Verified | Left after patch | WCAG A/AA before → after | Time |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const p of r.pages) {
    const pm = metricsOf(p.outcomes);
    L.push(
      `| ${path.relative(r.corpus, p.file).split(path.sep).join("/")} | ${pm.detected} | ${pm.verified} | ${p.remaining?.length ?? "n/a"} | ${
        p.allBefore
      } → ${p.allAfter ?? "n/a"} | ${(p.ms / 1000).toFixed(1)} s |`,
    );
  }
  L.push("");

  const row = (p: PageOutcome, o: PatchOutcome) =>
    `| ${path.basename(p.file)} | ${o.finding.id} (line ${o.finding.sourceLines?.start ?? "?"}) | ${o.finding.ruleId} | ${tierOf(o) ?? "-"} | ${
      o.verification.status
    } | ${cell(o.verification.reason)} |`;

  if (m.suspicious) {
    L.push(`## Suspicious patches`);
    L.push("");
    L.push(
      `These passed axe but tripped a suspicion check: they may silence the rule instead of fixing the problem. They are included in the output patch, marked, unless \`--strict\` is set. Review them first.`,
    );
    L.push("");
    L.push(`| Page | Finding | Rule | Tier | Status | Why |`);
    L.push(`|---|---|---|---|---|---|`);
    for (const p of r.pages) for (const o of p.outcomes) if (o.verification.status === "rejected_suspicious") L.push(row(p, o));
    L.push("");
  }

  const rejected = (s: VerificationStatus) => s !== "verified" && s !== "rejected_suspicious" && s !== "skipped";
  if (all.some((o) => rejected(o.verification.status))) {
    L.push(`## Rejections`);
    L.push("");
    L.push(`| Page | Finding | Rule | Tier | Status | Reason |`);
    L.push(`|---|---|---|---|---|---|`);
    for (const p of r.pages) for (const o of p.outcomes) if (rejected(o.verification.status)) L.push(row(p, o));
    L.push("");
  }

  if (m.skipped) {
    L.push(`## Skipped`);
    L.push("");
    const reasons: Record<string, number> = {};
    for (const o of all) {
      if (o.verification.status !== "skipped") continue;
      const k = `${o.finding.ruleId}: ${o.verification.reason ?? ""}`;
      reasons[k] = (reasons[k] ?? 0) + 1;
    }
    L.push(`| Rule and reason | Count |`);
    L.push(`|---|---|`);
    for (const [k, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) L.push(`| ${cell(k)} | ${n} |`);
    L.push("");
  }

  L.push(`## Definitions`);
  L.push("");
  L.push(`- **Detected**: violations of the patched rule subset reported by axe-core, one per node.`);
  L.push(`- **Skipped**: no patch attempted: the rule's deterministic codemod declined (the fix needs judgment) and no model was configured.`);
  L.push(`- **Proposed**: a well-formed patch was produced, by a tier-0 codemod or by the tier-1 model (valid JSON matching the schema, within 3 attempts).`);
  L.push(`- **Applied**: the patch passed shape validation (exact \`before\` substring, ≤ 6 lines, ≤ 2 hunks) and the patched page was re-audited.`);
  L.push(
    `- **Verified**: after applying the patch to a copy, the original violation is gone from the target node, no new WCAG 2.x A/AA violation appeared anywhere on the page, and no suspicion check fired.`,
  );
  L.push(`- **False-fix rate**: of the patches that made axe happy, the share flagged as suspicious.`);
  L.push(`- **Regression rate**: of the applied patches, the share that introduced a new violation.`);
  L.push(`- Token costs count input, output, and prompt-cache reads and writes. Dollar figures are estimates from list prices.`);
  L.push("");

  if (r.notes) {
    L.push(r.notes.trim());
    L.push("");
  }
  return L.join("\n");
}
