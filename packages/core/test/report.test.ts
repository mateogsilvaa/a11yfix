// Benchmark statistics: the Wilson interval and the verifier ablation counts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import {
  corpusSetOf,
  metricsFile,
  metricsOf,
  rateCI,
  renderReport,
  splitPages,
  wilson,
  type MetricsFile,
  type PageOutcome,
  type PatchOutcome,
  type ReportInput,
  type Rule,
  type Verification,
} from "verifa11y-core";

describe("wilson", () => {
  it("matches known 95% intervals", () => {
    const [lo, hi] = wilson(136, 136);
    assert.ok(Math.abs(lo - 0.9725) < 0.001, `lo ${lo}`);
    assert.equal(hi, 1);
    const [lo2, hi2] = wilson(11, 20);
    assert.ok(Math.abs(lo2 - 0.3421) < 0.001 && Math.abs(hi2 - 0.7418) < 0.001, `${lo2} ${hi2}`);
  });
  it("is uninformative with no samples", () => {
    assert.deepEqual(wilson(0, 0), [0, 1]);
    assert.equal(rateCI(0, 0), "n/a");
  });
  it("prints the sample size with the rate", () => {
    assert.equal(rateCI(136, 136), "100.0% [97.3–100], n=136");
  });
});

describe("verifier ablation counts", () => {
  const outcome = (status: Verification["status"], flaggedBy?: Verification["flaggedBy"]) =>
    ({
      finding: { ruleId: "image-alt" },
      generation: { patch: { findingId: "f" }, tier: 1, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } },
      verification: { status, flaggedBy },
    }) as unknown as PatchOutcome;

  it("separates what axe, the source checks and the browser checks reject", () => {
    const m = metricsOf([
      outcome("verified"),
      outcome("rejected_suspicious", ["static"]),
      outcome("rejected_suspicious", ["static", "accessibility-tree"]),
      outcome("rejected_suspicious", ["visual"]),
      outcome("rejected_suspicious", ["rule"]),
      outcome("rejected_regression", ["static"]),
      outcome("rejected_persists"),
    ]);
    assert.equal(m.applied, 7);
    assert.equal(m.axeAccepted, 5); // verified + every suspicious one
    assert.equal(m.sourceAccepted, 2); // verified + the one only the browser checks caught
    assert.equal(m.verified, 1);
  });
});

describe("dev / eval split", () => {
  const corpus = path.join("x", "corpus");
  const zero = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const outcome = (ruleId: string, status: Verification["status"]) =>
    ({
      finding: { id: "f_0001", ruleId, sourceLines: { start: 1 } },
      generation: { patch: status === "skipped" ? null : { findingId: "f_0001" }, tier: 0, usage: zero },
      verification: { status },
    }) as unknown as PatchOutcome;
  const page = (rel: string, outcomes: PatchOutcome[]) =>
    ({ file: path.join(corpus, ...rel.split("/")), outcomes, ms: 1000, remaining: [], allBefore: outcomes.length, allAfter: 0 }) as unknown as PageOutcome;
  const rules = [
    { id: "image-alt", axe: "image-alt", version: "1.0.0", tier: 0 },
    { id: "label", axe: "label", version: "1.0.0", tier: 0 },
  ] as unknown as Rule[];
  const input = (pages: PageOutcome[], compare?: MetricsFile): ReportInput => ({
    generator: "codemods only",
    mode: "codemod",
    strict: false,
    model: null,
    corpus,
    rules,
    pages,
    versions: {},
    wallMs: 1,
    date: "2026-11-20",
    compare,
  });
  const pages = [
    page("handwritten/01.html", [outcome("image-alt", "verified"), outcome("image-alt", "verified"), outcome("label", "skipped")]),
    page("eval/mdn/bad-form.html", [outcome("label", "verified"), outcome("label", "rejected_persists")]),
    page("eval/startbootstrap/agency/index.html", [outcome("image-alt", "rejected_suspicious")]),
  ];

  it("puts pages under a directory named eval in the eval set", () => {
    assert.equal(corpusSetOf(corpus, path.join(corpus, "eval", "mdn", "a.html")), "eval");
    assert.equal(corpusSetOf(corpus, path.join(corpus, "handwritten", "a.html")), "dev");
    assert.equal(corpusSetOf(corpus, path.join(corpus, "eval.html")), "dev"); // a file, not a directory
    assert.equal(corpusSetOf(corpus, path.join(corpus, "external", "evaluation", "a.html")), "dev");
    // Benchmarking the eval directory on its own still labels it eval.
    assert.equal(corpusSetOf(path.join(corpus, "eval"), path.join(corpus, "eval", "mdn", "a.html")), "eval");
  });

  it("does not split a run that has only one set", () => {
    assert.equal(splitPages(corpus, [pages[0]!]), null);
    assert.equal(splitPages(corpus, [pages[1]!]), null);
    assert.equal(metricsFile(input([pages[0]!])).bySet, undefined);
  });

  it("writes metrics for each set next to the combined ones", () => {
    const f = metricsFile(input(pages));
    assert.equal(f.pages, 3);
    assert.equal(f.overall.detected, 6);
    assert.ok(f.bySet);
    assert.equal(f.bySet.dev.pages, 1);
    assert.equal(f.bySet.eval.pages, 2);
    assert.equal(f.bySet.dev.overall.verified, 2);
    assert.equal(f.bySet.eval.overall.verified, 1);
    assert.equal(f.bySet.eval.overall.detected, 3);
    assert.deepEqual(Object.keys(f.bySet.dev.byRule).sort(), ["image-alt", "label"]);
    assert.equal(f.bySet.eval.byRule["label"]?.proposed, 2);
    assert.equal(f.bySet.eval.byRule["image-alt"]?.suspicious, 1);
  });

  it("reports eval and dev separately, each with its summary, CIs, ablation and rule table", () => {
    const md = renderReport(input(pages));
    assert.match(md, /3 pages: 2 eval, held out; 1 dev, used for tuning/);
    assert.match(md, /^## Dev and eval$/m);
    const evalAt = md.indexOf("## Eval (held out)");
    const devAt = md.indexOf("## Dev (used for tuning)");
    const byPage = md.indexOf("## By page");
    assert.ok(evalAt > 0 && devAt > evalAt && byPage > devAt, "eval first, then dev, then the shared sections");
    for (const section of [md.slice(evalAt, devAt), md.slice(devAt, byPage)]) {
      for (const h of ["### Summary", "### By tier", "### What the verifier adds", "### Outcomes", "### By rule"]) {
        assert.ok(section.includes(h), `${h} in each set`);
      }
    }
    const evalSection = md.slice(evalAt, devAt);
    // eval: 1 verified of 3 detected, of 3 proposed; label 1 of 2 proposed.
    assert.match(evalSection, /\| \*\*Fix rate\*\* \(verified \/ detected\) \| \*\*33\.3% \[[\d.]+–[\d.]+\], n=3\*\* \|/);
    assert.match(evalSection, /\| label \| 1\.0\.0 \| 0 \| 2 \| 0 \| 2 \| 1 \| 50\.0% \| 50\.0% \[[\d.]+–[\d.]+\], n=2 \|/);
    assert.doesNotMatch(evalSection, /handwritten/);
    // The side-by-side table lists eval before dev.
    assert.match(md, /\| Pages \| 2 \| 1 \|/);
    assert.match(md, /\| eval\/mdn\/bad-form\.html \| eval \| 2 \| 1 \|/);
    // Pages are named by their path: several eval pages are index.html.
    assert.match(md, /\| eval\/startbootstrap\/agency\/index\.html \| f_0001/);
    assert.match(md, /\*\*Eval \/ dev\*\*/);
  });

  it("compares each set with the same set of the other run", () => {
    const baseline = metricsFile(input(pages));
    const md = renderReport(input(pages, baseline));
    assert.match(md, /### Compared with `codemods only` \(2026-11-20, eval pages\)/);
    assert.match(md, /### Compared with `codemods only` \(2026-11-20, dev pages\)/);
    const old = metricsFile(input([pages[0]!])); // a run from before the split
    assert.match(renderReport(input(pages, old)), /Not compared: that run has no eval split\./);
  });

  it("keeps the single-set layout when there is no eval page", () => {
    const md = renderReport(input([pages[0]!]));
    assert.doesNotMatch(md, /Dev and eval|Eval \(held out\)|\*\*Eval \/ dev\*\*/);
    assert.match(md, /^## Summary$/m);
    assert.match(md, /^## What the verifier adds$/m);
    assert.match(md, /^## By rule$/m);
  });
});
