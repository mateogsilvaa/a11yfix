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

import type { DeepCheckOptions } from "./deepcheck.js";
import type { Impact } from "./types.js";
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
  /** Applied patches an axe-only verifier would have accepted (violation gone, nothing new): verified + suspicious. */
  axeAccepted: number;
  /** ...that axe plus the source-level suspicion checks (static and the rule's own) would have accepted. */
  sourceAccepted: number;
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
    axeAccepted: st("verified") + st("rejected_suspicious"),
    sourceAccepted:
      st("verified") +
      outcomes.filter((o) => o.verification.status === "rejected_suspicious" && !(o.verification.flaggedBy ?? []).some((l) => l === "static" || l === "rule"))
        .length,
    usage: outcomes.reduce((u, o) => addUsage(u, o.generation.usage), ZERO_USAGE),
  };
}

/** Wilson score interval for k successes out of n, 95% by default. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  // Exact at the edges: floating point would print 100% as 99.99...
  return [k === 0 ? 0 : Math.max(0, mid - half), k === n ? 1 : Math.min(1, mid + half)];
}

/** "97.1% [92.4–99.0], n=136": a rate with its 95% Wilson interval and sample size. */
export function rateCI(k: number, n: number): string {
  if (n === 0) return "n/a";
  const [lo, hi] = wilson(k, n);
  const f = (x: number) => (100 * x).toFixed(1).replace(/\.0$/, "");
  return `${((100 * k) / n).toFixed(1)}% [${f(lo)}–${f(hi)}], n=${n}`;
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
  /** Verifier checks beyond axe that ran (accessibility tree, focus, visual). */
  checks?: DeepCheckOptions | null;
  regressionImpact?: Impact;
}

/**
 * Pages under a directory named `eval` are the held-out set: never used to write or tune codemods, rules, prompts or
 * the verifier. Everything else is dev. See corpus/README.md and ADR 0017.
 */
export type CorpusSet = "dev" | "eval";
export const EVAL_DIR = "eval";

/** "eval" when a directory named `eval` sits between the corpus root (inclusive) and the page, else "dev". */
export function corpusSetOf(corpus: string, file: string): CorpusSet {
  const dirs = path.relative(corpus, file).split(path.sep).slice(0, -1);
  return [path.basename(path.resolve(corpus)), ...dirs].includes(EVAL_DIR) ? "eval" : "dev";
}

/** Dev and eval pages, or null when the run lacks one of the two and there is nothing to split. */
export function splitPages(corpus: string, pages: PageOutcome[]): Record<CorpusSet, PageOutcome[]> | null {
  const out: Record<CorpusSet, PageOutcome[]> = { dev: [], eval: [] };
  for (const p of pages) out[corpusSetOf(corpus, p.file)].push(p);
  return out.dev.length && out.eval.length ? out : null;
}

export interface SetMetrics {
  pages: number;
  overall: Metrics;
  byTier: { "0": Metrics; "1": Metrics };
  byRule: Record<string, Metrics>;
}

/** Machine-readable metrics written next to every report (used for comparisons). */
export interface MetricsFile extends SetMetrics {
  generator: string;
  date: string;
  versions: Record<string, string>;
  /** Dev and eval separately, when the run has both. `overall`, `byTier` and `byRule` mix them. */
  bySet?: Record<CorpusSet, SetMetrics>;
}

function setMetrics(rules: Rule[], pages: PageOutcome[]): SetMetrics {
  const all = pages.flatMap((p) => p.outcomes);
  const byRule: Record<string, Metrics> = {};
  for (const rule of rules) {
    const o = all.filter((x) => x.finding.ruleId === rule.axe);
    if (o.length) byRule[rule.id] = metricsOf(o);
  }
  return {
    pages: pages.length,
    overall: metricsOf(all),
    byTier: { "0": metricsOf(all.filter((o) => tierOf(o) === 0)), "1": metricsOf(all.filter((o) => tierOf(o) === 1)) },
    byRule,
  };
}

export function metricsFile(r: ReportInput): MetricsFile {
  const split = splitPages(r.corpus, r.pages);
  return {
    generator: r.generator,
    date: r.date,
    versions: r.versions,
    ...setMetrics(r.rules, r.pages),
    ...(split ? { bySet: { dev: setMetrics(r.rules, split.dev), eval: setMetrics(r.rules, split.eval) } } : {}),
  };
}

const SET_TITLE: Record<CorpusSet, string> = { eval: "Eval (held out)", dev: "Dev (used for tuning)" };
const relPath = (corpus: string, file: string) => path.relative(corpus, file).split(path.sep).join("/");

export function renderReport(r: ReportInput): string {
  const all = r.pages.flatMap((p) => p.outcomes);
  const m = metricsOf(all);
  const split = splitPages(r.corpus, r.pages);

  const L: string[] = [];
  L.push(`# verifa11y benchmark report`);
  L.push("");
  L.push(`- Mode: \`${r.mode}\` (${r.generator})${r.strict ? ", strict" : ""}`);
  L.push(
    `- Corpus: \`${r.corpus}\` (${r.pages.length} pages${split ? `: ${split.eval.length} eval, held out; ${split.dev.length} dev, used for tuning` : ""})`,
  );
  L.push(`- Engines: ${Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  L.push(`- Run ${r.date}, total wall time ${(r.wallMs / 1000).toFixed(1)} s`);
  L.push("");
  L.push(`> verifa11y does not guarantee WCAG conformance. "Verified" means axe-core no longer reports the violation and nothing else broke; it is not a human review.`);
  L.push("");

  if (split) {
    const e = setMetrics(r.rules, split.eval);
    const d = setMetrics(r.rules, split.dev);
    L.push(`## Dev and eval`);
    L.push("");
    L.push(
      `Dev pages were read and debugged while the codemods and prompts were written, so their numbers are optimistic. Eval pages (under \`${EVAL_DIR}/\`) were never used for tuning: quote those. Each set is reported in full below.`,
    );
    L.push("");
    const rows: Array<[string, (s: SetMetrics) => string]> = [
      ["Pages", (s) => String(s.pages)],
      ["Violations detected", (s) => String(s.overall.detected)],
      ["Patches verified", (s) => String(s.overall.verified)],
      ["**Fix rate** (verified / detected)", (s) => rateCI(s.overall.verified, s.overall.detected)],
      ["**Precision** (verified / proposed)", (s) => rateCI(s.overall.verified, s.overall.proposed)],
      ["Tier 0 precision", (s) => rateCI(s.byTier["0"].verified, s.byTier["0"].proposed)],
      ["Tier 1 precision", (s) => rateCI(s.byTier["1"].verified, s.byTier["1"].proposed)],
      ["False-fix rate", (s) => rateCI(s.overall.suspicious, s.overall.verified + s.overall.suspicious)],
      ["Regression rate", (s) => rateCI(s.overall.regression, s.overall.applied)],
    ];
    L.push(`| Metric | ${SET_TITLE.eval} | ${SET_TITLE.dev} |`);
    L.push(`|---|---|---|`);
    for (const [label, f] of rows) L.push(`| ${label} | ${f(e)} | ${f(d)} |`);
    L.push("");
    for (const set of ["eval", "dev"] as const) {
      L.push(`## ${SET_TITLE[set]}`);
      L.push("");
      L.push(...renderSet(r, split[set], set, "###"));
    }
  } else {
    L.push(...renderSet(r, r.pages, null, "##"));
  }

  L.push(`## By page`);
  L.push("");
  L.push(`| Page | ${split ? "Set | " : ""}Detected | Verified | Left after patch | WCAG A/AA before → after | Time |`);
  L.push(`|---|${split ? "---|" : ""}---|---|---|---|---|`);
  for (const p of r.pages) {
    const pm = metricsOf(p.outcomes);
    L.push(
      `| ${relPath(r.corpus, p.file)} | ${split ? `${corpusSetOf(r.corpus, p.file)} | ` : ""}${pm.detected} | ${pm.verified} | ${p.remaining?.length ?? "n/a"} | ${
        p.allBefore
      } → ${p.allAfter ?? "n/a"} | ${(p.ms / 1000).toFixed(1)} s |`,
    );
  }
  L.push("");

  // The relative path, not the basename: several eval pages are called index.html.
  const row = (p: PageOutcome, o: PatchOutcome) =>
    `| ${relPath(r.corpus, p.file)} | ${o.finding.id} (line ${o.finding.sourceLines?.start ?? "?"}) | ${o.finding.ruleId} | ${tierOf(o) ?? "-"} | ${
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

  L.push(`## Verifier checks`);
  L.push("");
  L.push(renderChecks(r, all));
  L.push("");

  L.push(`## Definitions`);
  L.push("");
  if (split) {
    L.push(
      `- **Eval / dev**: pages under a directory named \`${EVAL_DIR}\` are held out: never used to write or tune codemods, rules, prompts or the verifier. All other pages are dev. A page used for tuning moves to dev.`,
    );
  }
  L.push(`- **Detected**: violations of the patched rule subset reported by axe-core, one per node.`);
  L.push(`- **Skipped**: no patch attempted: the rule's deterministic codemod declined (the fix needs judgment) and no model was configured.`);
  L.push(`- **Proposed**: a well-formed patch was produced, by a tier-0 codemod or by the tier-1 model (valid JSON matching the schema, within 3 attempts).`);
  L.push(`- **Applied**: the patch passed shape validation (exact \`before\` substring, ≤ 6 lines, ≤ 2 hunks) and the patched page was re-audited.`);
  L.push(
    `- **Verified**: after applying the patch to a copy, the original violation is gone from the target node, no new WCAG 2.x A/AA violation appeared anywhere on the page, and no suspicion check fired (static checks, plus the accessibility-tree, focus-order and visual comparisons when they ran).`,
  );
  L.push(`- **False-fix rate**: of the patches that made axe happy, the share flagged as suspicious.`);
  L.push(`- **Regression rate**: of the applied patches, the share that introduced a new violation.`);
  L.push(`- **[95% CI]**: Wilson score interval. With samples this small, intervals are wide; differences inside them are not evidence.`);
  L.push(`- Token costs count input, output, and prompt-cache reads and writes. Dollar figures are estimates from list prices.`);
  L.push("");

  if (r.notes) {
    L.push(r.notes.trim());
    L.push("");
  }
  return L.join("\n");
}

/** Summary, tiers, comparison, verifier ablation, outcomes and rules for one set of pages (`set` null: the whole run). */
function renderSet(r: ReportInput, pages: PageOutcome[], set: CorpusSet | null, h: "##" | "###"): string[] {
  const all = pages.flatMap((p) => p.outcomes);
  const m = metricsOf(all);
  const t0 = metricsOf(all.filter((o) => tierOf(o) === 0));
  const t1 = metricsOf(all.filter((o) => tierOf(o) === 1));
  const totalTokens = tokens(m.usage);
  const usd = r.model ? estimateUsd(r.model, m.usage) : null;
  const avgPageMs = pages.reduce((s, p) => s + p.ms, 0) / Math.max(1, pages.length);
  const remaining = pages.reduce((s, p) => s + (p.remaining?.length ?? 0), 0);
  const allBefore = pages.reduce((s, p) => s + p.allBefore, 0);
  const allAfter = pages.reduce((s, p) => s + (p.allAfter ?? 0), 0);

  const L: string[] = [];
  L.push(`${h} Summary`);
  L.push("");
  L.push(`| Metric | Value |`);
  L.push(`|---|---|`);
  L.push(`| Pages | ${pages.length} |`);
  L.push(`| Violations detected | ${m.detected} |`);
  L.push(`| Skipped (needs judgment, no model in this run) | ${m.skipped} |`);
  L.push(`| Patches proposed | ${m.proposed} |`);
  L.push(`| Patches verified | ${m.verified} |`);
  L.push(`| **Fix rate** (verified / detected) | **${rateCI(m.verified, m.detected)}** |`);
  L.push(`| **Precision** (verified / proposed) | **${rateCI(m.verified, m.proposed)}** |`);
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

  L.push(`${h} By tier`);
  L.push("");
  L.push(`Tier 0 is deterministic codemods and is held to 100% precision. Tier 1 is the model, used only where judgment is needed.`);
  L.push("");
  L.push(`| Tier | Proposed | Verified | Precision [95% CI] | Suspicious | Regressions | Persists | Invalid shape | Tokens / fix |`);
  L.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const [name, t] of [["0 (codemod)", t0], ["1 (model)", t1]] as const) {
    L.push(
      `| ${name} | ${t.proposed} | ${t.verified} | **${rateCI(t.verified, t.proposed)}** | ${t.suspicious} | ${t.regression} | ${t.persists} | ${t.invalid + t.applyFailed} | ${
        t.verified ? fmtInt(Math.round(tokens(t.usage) / t.verified)) : "n/a"
      } |`,
    );
  }
  L.push("");

  // Compare like with like: this run's eval pages with the other run's eval pages.
  if (r.compare) {
    const b = set ? r.compare.bySet?.[set]?.overall : r.compare.overall;
    L.push(`${h} Compared with \`${r.compare.generator}\` (${r.compare.date}${set ? `, ${set} pages` : ""})`);
    L.push("");
    if (b) {
      L.push(`| Metric | This run | ${r.compare.generator} |`);
      L.push(`|---|---|---|`);
      L.push(`| Fix rate | ${pct(m.verified, m.detected)} | ${pct(b.verified, b.detected)} |`);
      L.push(`| Precision | ${pct(m.verified, m.proposed)} | ${pct(b.verified, b.proposed)} |`);
      L.push(`| False-fix rate | ${pct(m.suspicious, m.verified + m.suspicious)} | ${pct(b.suspicious, b.verified + b.suspicious)} |`);
      L.push(`| Regression rate | ${pct(m.regression, m.applied)} | ${pct(b.regression, b.applied)} |`);
    } else {
      L.push(`Not compared: that run has no ${set} split.`);
    }
    L.push("");
  }

  L.push(...renderAblation(all, h));
  L.push("");

  L.push(`${h} Outcomes`);
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

  L.push(`${h} By rule`);
  L.push("");
  L.push(`| Rule | Version | Tier | Detected | Skipped | Proposed | Verified | Fix rate | Precision [95% CI] | False-fix | Regression |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const rule of r.rules) {
    const o = all.filter((x) => x.finding.ruleId === rule.axe);
    if (!o.length) continue;
    const rm = metricsOf(o);
    L.push(
      `| ${rule.id} | ${rule.version} | ${rule.tier} | ${rm.detected} | ${rm.skipped} | ${rm.proposed} | ${rm.verified} | ${pct(rm.verified, rm.detected)} | ${rateCI(rm.verified, rm.proposed)} | ${pct(rm.suspicious, rm.verified + rm.suspicious)} | ${pct(rm.regression, rm.applied)} |`,
    );
  }
  L.push("");
  return L;
}

/**
 * What each verifier layer adds: how many patches each weaker verifier would have accepted, and how many of
 * those the full verifier rejects. "Rejected" is relative to the full verifier, which is not ground truth either.
 */
function renderAblation(all: PatchOutcome[], h: "##" | "###"): string[] {
  const L: string[] = [];
  L.push(`${h} What the verifier adds`);
  L.push("");
  L.push(
    `Every patch that applied cleanly, judged by weaker verifiers. "Shipped but rejected by the full verifier" counts patches a pipeline with that verifier would have put in the output and called fixed. The full verifier is the reference here, not ground truth: a patch it accepts can still be wrong in ways no automatic check sees.`,
  );
  L.push("");
  L.push(`| Tier | Verifier | Would ship | Shipped but rejected by the full verifier | Share of shipped |`);
  L.push(`|---|---|---:|---:|---|`);
  for (const [name, tier] of [["0 (codemod)", 0], ["1 (model)", 1]] as const) {
    const t = metricsOf(all.filter((o) => tierOf(o) === tier));
    if (!t.applied) continue;
    const rows: Array<[string, number]> = [
      ["none (shape validation only)", t.applied],
      ["axe only", t.axeAccepted],
      ["axe + source checks", t.sourceAccepted],
      ["full (+ accessibility tree, focus order, pixels)", t.verified],
    ];
    for (const [label, n] of rows) L.push(`| ${name} | ${label} | ${n} | ${n - t.verified} | ${rateCI(n - t.verified, n)} |`);
  }
  if (!all.some((o) => APPLIED.includes(o.verification.status))) L.push(`| - | no patch applied in this run | 0 | 0 | n/a |`);
  return L;
}

function renderChecks(r: ReportInput, all: PatchOutcome[]): string {
  const c = r.checks;
  const L: string[] = [];
  L.push(`Every applied patch is compared with the original page: axe-core with the full WCAG 2.x A/AA rule set${r.regressionImpact && r.regressionImpact !== "minor" ? ` (new violations below "${r.regressionImpact}" impact are reported, not rejected)` : ""}, static suspicion checks on the patched source, and:`);
  L.push("");
  L.push(`- accessibility tree (computed role, name, states, focusability of every element): ${c?.ax ? "on" : "off"}`);
  L.push(`- focus order (Tab sequence): ${c?.focus ? "on" : "off"}`);
  L.push(
    `- visual (full-page screenshots): ${c?.visual.length ? `${c.visual.map((v) => `${v.name} ${v.width}x${v.height}`).join(", ")}; limit ${(c.maxVisualChange * 100).toFixed(2)}% of pixels changed outside the patched elements${c.maxLayoutShift !== null ? `, at most ${c.maxLayoutShift} element(s) moved` : "; layout shifts measured, not enforced"}` : "off"}`,
  );
  if (!c) return L.join("\n");
  const checked = all.filter((o) => o.verification.checks);
  const reasonHas = (o: PatchOutcome, prefix: string) => (o.verification.reason ?? "").includes(prefix);
  const flagged = (prefix: string) => all.filter((o) => o.verification.status === "rejected_suspicious" && reasonHas(o, prefix)).length;
  const visual = checked.flatMap((o) => o.verification.checks?.visual ?? []);
  const shifted = checked.filter((o) => (o.verification.checks?.visual ?? []).some((v) => v.layoutShift > 0));
  const maxChange = visual.reduce((m, v) => Math.max(m, v.layoutShift === 0 ? v.changeOutside : 0), 0);
  L.push("");
  L.push(`| | Patches |`);
  L.push(`|---|---:|`);
  L.push(`| Compared beyond axe | ${checked.length} |`);
  L.push(`| Rejected by the accessibility-tree comparison | ${flagged("accessibility tree:")} |`);
  L.push(`| Rejected by the focus-order comparison | ${flagged("focus order:")} |`);
  L.push(`| Rejected by the visual comparison | ${flagged("visual (")} |`);
  L.push(`| Moved other elements on the page (layout shift, reported only) | ${shifted.length} |`);
  L.push("");
  L.push(`Largest pixel change outside the patched elements on a page without layout shift: ${(maxChange * 100).toFixed(3)}%.`);
  return L.join("\n");
}
