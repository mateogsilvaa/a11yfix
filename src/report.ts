// Benchmark metrics and the report.md renderer.
//
// Definitions (also printed in the report):
//   detected     = subset violations found by the auditor
//   proposed     = findings for which the generator returned a well-formed patch
//   applied      = proposed patches that passed shape validation and were re-audited
//   verified     = applied patches that removed the violation, added none, and were not suspicious
//   fix rate     = verified / detected
//   precision    = verified / proposed
//   false-fix    = suspicious / (verified + suspicious)   (share of axe-passing patches that only silenced axe)
//   regression   = rejected_regression / applied

import path from "node:path";
import { estimateUsd } from "./generate.js";
import { RULES } from "./rules.js";
import { ZERO_USAGE, addUsage, type Usage, type VerificationStatus } from "./types.js";
import type { PageOutcome, PatchOutcome } from "./pipeline.js";

export interface Metrics {
  detected: number;
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
    proposed: outcomes.filter((o) => o.generation.patch !== null).length,
    applied: outcomes.filter((o) => APPLIED.includes(o.verification.status)).length,
    verified: st("verified"),
    suspicious: st("rejected_suspicious"),
    regression: st("rejected_regression"),
    persists: st("rejected_persists"),
    invalid: outcomes.filter((o) => o.generation.patch !== null && o.verification.status === "rejected_invalid").length,
    applyFailed: st("rejected_apply_failed"),
    generationFailed: outcomes.filter((o) => o.generation.patch === null).length,
    usage: outcomes.reduce((u, o) => addUsage(u, o.generation.usage), ZERO_USAGE),
  };
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const tokens = (u: Usage) => u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
const fmtInt = (n: number) => n.toLocaleString("en-US");

/** Machine-readable metrics written next to every report (used for comparisons). */
export interface MetricsFile {
  generator: string;
  date: string;
  pages: number;
  overall: Metrics;
  byRule: Record<string, Metrics>;
}

export function metricsFile(r: ReportInput): MetricsFile {
  const all = r.pages.flatMap((p) => p.outcomes);
  const byRule: Record<string, Metrics> = {};
  for (const rule of RULES) {
    const o = all.filter((x) => x.finding.ruleId === rule.id);
    if (o.length) byRule[rule.id] = metricsOf(o);
  }
  return { generator: r.generator, date: r.date, pages: r.pages.length, overall: metricsOf(all), byRule };
}

export interface ReportInput {
  generator: string;
  model: string | null;
  corpus: string;
  pages: PageOutcome[];
  axeVersion: string;
  wallMs: number;
  date: string;
  notes?: string;
  /** Metrics of another run (e.g. the heuristic baseline) to compare against. */
  compare?: MetricsFile;
}

export function renderReport(r: ReportInput): string {
  const all = r.pages.flatMap((p) => p.outcomes);
  const m = metricsOf(all);
  const totalTokens = tokens(m.usage);
  const usd = r.model ? estimateUsd(r.model, m.usage) : null;
  const avgPageMs = r.pages.reduce((s, p) => s + p.ms, 0) / Math.max(1, r.pages.length);
  const remaining = r.pages.reduce((s, p) => s + (p.remaining?.length ?? 0), 0);
  const allBefore = r.pages.reduce((s, p) => s + p.allBefore, 0);
  const allAfter = r.pages.reduce((s, p) => s + (p.allAfter ?? 0), 0);

  const L: string[] = [];
  L.push(`# a11yfix benchmark report`);
  L.push("");
  L.push(`- Generator: \`${r.generator}\``);
  L.push(`- Corpus: \`${r.corpus}\` (${r.pages.length} pages)`);
  L.push(`- axe-core ${r.axeVersion}, run ${r.date}, total wall time ${(r.wallMs / 1000).toFixed(1)} s`);
  L.push("");
  L.push(`## Summary`);
  L.push("");
  L.push(`| Metric | Value |`);
  L.push(`|---|---|`);
  L.push(`| Pages | ${r.pages.length} |`);
  L.push(`| Violations detected | ${m.detected} |`);
  L.push(`| Patches proposed | ${m.proposed} |`);
  L.push(`| Patches applied (passed shape validation) | ${m.applied} |`);
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
  L.push(`| Total tokens (input + output + cache read + cache write) | ${fmtInt(totalTokens)}${usd !== null ? ` (~$${usd.toFixed(2)})` : ""} |`);
  L.push(`| Mean time per page | ${(avgPageMs / 1000).toFixed(1)} s |`);
  L.push(`| Subset violations left after applying all verified patches | ${remaining} of ${m.detected} |`);
  L.push(`| WCAG A/AA violations (all rules) before → after | ${allBefore} → ${allAfter} |`);
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
    L.push(`| Rule | Fix rate (this run) | Fix rate (${r.compare.generator}) | Precision (this run) | Precision (${r.compare.generator}) |`);
    L.push(`|---|---|---|---|---|`);
    for (const rule of RULES) {
      const o = all.filter((x) => x.finding.ruleId === rule.id);
      const bm = r.compare.byRule[rule.id];
      if (!o.length || !bm) continue;
      const rm = metricsOf(o);
      L.push(`| ${rule.id} | ${pct(rm.verified, rm.detected)} | ${pct(bm.verified, bm.detected)} | ${pct(rm.verified, rm.proposed)} | ${pct(bm.verified, bm.proposed)} |`);
    }
    L.push("");
  }

  L.push(`## Outcomes`);
  L.push("");
  L.push(`| Status | Count |`);
  L.push(`|---|---|`);
  L.push(`| verified | ${m.verified} |`);
  L.push(`| rejected_persists | ${m.persists} |`);
  L.push(`| rejected_regression | ${m.regression} |`);
  L.push(`| rejected_suspicious | ${m.suspicious} |`);
  L.push(`| rejected_invalid (bad patch shape) | ${m.invalid} |`);
  L.push(`| rejected_invalid (no usable output) | ${m.generationFailed} |`);
  L.push(`| rejected_apply_failed | ${m.applyFailed} |`);
  L.push("");

  L.push(`## By rule`);
  L.push("");
  L.push(`| Rule | Level | Detected | Proposed | Verified | Fix rate | Precision | False-fix | Regression | Tokens / fix |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const rule of RULES) {
    const o = all.filter((x) => x.finding.ruleId === rule.id);
    if (!o.length) continue;
    const rm = metricsOf(o);
    L.push(
      `| ${rule.id} | ${rule.level} | ${rm.detected} | ${rm.proposed} | ${rm.verified} | ${pct(rm.verified, rm.detected)} | ${pct(
        rm.verified,
        rm.proposed,
      )} | ${pct(rm.suspicious, rm.verified + rm.suspicious)} | ${pct(rm.regression, rm.applied)} | ${
        rm.verified ? fmtInt(Math.round(tokens(rm.usage) / rm.verified)) : "n/a"
      } |`,
    );
  }
  L.push("");

  L.push(`## By page`);
  L.push("");
  L.push(`| Page | Detected | Verified | Left after combining | WCAG A/AA before → after | Time |`);
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

  const rejected = all.filter((o) => o.verification.status !== "verified");
  if (rejected.length) {
    L.push(`## Rejections`);
    L.push("");
    L.push(`Every rejected patch, with the verifier's reason.`);
    L.push("");
    L.push(`| Page | Finding | Rule | Status | Reason |`);
    L.push(`|---|---|---|---|---|`);
    for (const p of r.pages) {
      for (const o of p.outcomes) {
        if (o.verification.status === "verified") continue;
        L.push(
          `| ${path.basename(p.file)} | ${o.finding.id} (line ${o.finding.sourceLines?.start ?? "?"}) | ${o.finding.ruleId} | ${
            o.verification.status
          } | ${(o.verification.reason ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 220)} |`,
        );
      }
    }
    L.push("");
  }

  L.push(`## Definitions`);
  L.push("");
  L.push(`- **Detected**: violations of the patched rule subset reported by axe-core, one per node.`);
  L.push(`- **Proposed**: the generator returned a well-formed patch (valid JSON matching the schema, within 3 attempts).`);
  L.push(`- **Applied**: the patch passed shape validation (exact \`before\` substring, ≤ 6 lines, ≤ 2 hunks) and the patched page was re-audited.`);
  L.push(
    `- **Verified**: after applying the patch to a copy, the original violation is gone from the target node, no new WCAG 2.x A/AA violation appeared anywhere on the page, and no suspicion heuristic fired (element removed, aria-hidden or role=presentation/none added, content hidden, generic alt text or alt text that only restates the file name, alt="" on the only content of a link or button, a focusable element left without a role, a generic aria-label on a form control).`,
  );
  L.push(`- **False-fix rate**: of the patches that made axe happy, the share flagged as suspicious (silencing instead of fixing).`);
  L.push(`- **Regression rate**: of the applied patches, the share that introduced a new violation.`);
  L.push(`- Token costs count input, output, and prompt-cache reads and writes. Dollar figures are estimates from list prices.`);
  L.push("");
  L.push(`"Verified" means *axe-core no longer reports it and nothing else broke*. It does not mean a human confirmed the page is accessible. See the README's Limitations section.`);
  L.push("");

  if (r.notes) {
    L.push(r.notes.trim());
    L.push("");
  }
  return L.join("\n");
}
