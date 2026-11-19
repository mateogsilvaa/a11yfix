// Auditor: Playwright + axe-core.
//
// A single axe run per page covers both jobs:
//   - the rule subset we patch (findings), and
//   - the full WCAG 2.x A/AA rule set (used by the verifier to detect
//     regressions anywhere on the page).

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { withPage } from "./browser.js";
import { extractNodeContext } from "./context.js";
import { REGRESSION_TAGS, wcagFromTags } from "./wcag.js";
import {
  elementAtPath,
  elementLines,
  elementRange,
  parseSource,
  truncate,
  type ParsedSource,
} from "./source.js";
import type { CheckResult, Finding, Impact, NodeContext, SourceLocation, SourceRange } from "./types.js";

const require = createRequire(import.meta.url);
let axeSource: string | null = null;
async function getAxeSource(): Promise<string> {
  if (!axeSource) axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  return axeSource;
}

/** One violating node as reported by the browser, before source mapping. */
interface RawNode {
  selector: string;
  /** Child-element indexes from <html>; null when the node could not be resolved. */
  path: number[] | null;
  html: string;
  failureSummary: string;
  ancestorChain: string[];
  checks: CheckResult[];
  context: NodeContext | null;
}

interface RawViolation {
  ruleId: string;
  tags: string[];
  impact: Impact | null;
  help: string;
  description: string;
  helpUrl: string;
  nodes: RawNode[];
}

/** A violating node anywhere on the page, located in the source when possible. */
export interface PageViolation {
  ruleId: string;
  selector: string;
  sourceRange: SourceRange | null;
  sourceLines: SourceLocation | null;
}

export interface AuditResult {
  sourceFile: string;
  /** axe rule ids reported as findings in this audit. */
  rules: string[];
  /** Violations of the patched subset, normalized. */
  findings: Finding[];
  /** Every WCAG A/AA (+ subset) violation on the page, one entry per node. */
  all: PageViolation[];
  axeVersion: string;
  ms: number;
}

export interface AuditOptions {
  /** axe rule ids to report as findings (usually `registry.axeIds()`). */
  rules?: string[];
  /** Drop findings a rule's `detect()` filter rejects. */
  filter?: (f: Finding) => boolean;
}

/** Audit a file on disk. */
export async function auditFile(file: string, opts: AuditOptions = {}): Promise<AuditResult> {
  const src = await readFile(file, "utf8");
  return auditSource(file, src, opts);
}

/**
 * Audit `src` as if it were the contents of `file` (relative resources are
 * resolved against the file's directory). The verifier uses this to audit
 * patched copies.
 */
export async function auditSource(
  file: string,
  src: string,
  opts: AuditOptions = {},
): Promise<AuditResult> {
  const started = Date.now();
  const subset = opts.rules ?? [];
  const axe = await getAxeSource();

  const { version, violations } = await withPage(file, src, async (page) => {
    await page.evaluate(axe);
    // Installed via CDP evaluate (not new Function in the page), so the
    // page's script-src 'none' CSP does not block it.
    await page.evaluate(`globalThis.__a11yfixContext = (${extractNodeContext.toString()})`);
    return page.evaluate(runAxeInPage, { subset, tags: REGRESSION_TAGS });
  });

  const parsed = parseSource(src);
  const sourceFile = toPosix(path.relative(process.cwd(), path.resolve(file)));
  const findings: Finding[] = [];
  const all: PageViolation[] = [];

  for (const v of violations) {
    const inSubset = subset.includes(v.ruleId);
    v.nodes.forEach((n, nodeIndex) => {
      const located = locate(parsed, n.path);
      all.push({ ruleId: v.ruleId, selector: n.selector, ...located });
      if (!inSubset) return;
      findings.push({
        id: "", // assigned below, after sorting
        ruleId: v.ruleId,
        wcag: wcagFromTags(v.tags),
        impact: v.impact,
        selector: n.selector,
        nodeIndex,
        outerHTML: truncate(n.html, 2000),
        sourceSnippet: located.sourceRange
          ? src.slice(located.sourceRange.start, located.sourceRange.end)
          : null,
        ancestorChain: n.ancestorChain,
        sourceFile,
        sourceLines: located.sourceLines,
        sourceRange: located.sourceRange,
        help: v.help,
        description: v.description,
        helpUrl: v.helpUrl,
        failureSummary: n.failureSummary,
        checks: n.checks,
        context: n.context ?? emptyContext(),
      });
    });
  }

  if (opts.filter) {
    const keep = findings.filter(opts.filter);
    findings.length = 0;
    findings.push(...keep);
  }

  // Stable ids: order by position in the file, then rule, so ids do not depend
  // on axe's rule iteration order.
  findings.sort(
    (a, b) =>
      (a.sourceRange?.start ?? Number.MAX_SAFE_INTEGER) -
        (b.sourceRange?.start ?? Number.MAX_SAFE_INTEGER) ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.nodeIndex - b.nodeIndex,
  );
  findings.forEach((f, i) => (f.id = `f_${String(i + 1).padStart(4, "0")}`));

  return { sourceFile, rules: subset, findings, all, axeVersion: version, ms: Date.now() - started };
}

function locate(
  parsed: ParsedSource,
  domPath: number[] | null,
): { sourceRange: SourceRange | null; sourceLines: SourceLocation | null } {
  if (!domPath) return { sourceRange: null, sourceLines: null };
  const el = elementAtPath(parsed, domPath);
  if (!el) return { sourceRange: null, sourceLines: null };
  return { sourceRange: elementRange(el), sourceLines: elementLines(el) };
}

function emptyContext(): NodeContext {
  return { tagName: "", attributes: {}, text: "", nearbyText: "", computedStyle: {} };
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/* ------------------------------------------------------------------------ */
/* Runs inside the page. Must be self-contained: it is serialized by        */
/* Playwright, so it cannot close over anything from this module.            */
/* ------------------------------------------------------------------------ */

async function runAxeInPage(args: {
  subset: string[];
  tags: string[];
}): Promise<{ version: string; violations: RawViolation[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const axe = w.axe;
  const extractContext = w.__a11yfixContext as (el: Element, ruleId: string) => NodeContext;

  const wcagRules: string[] = axe
    .getRules(args.tags)
    .filter((r: { tags: string[] }) => !r.tags.includes("experimental"))
    .map((r: { ruleId: string }) => r.ruleId);
  const rules = Array.from(new Set([...wcagRules, ...args.subset]));

  const result = await axe.run(document, {
    runOnly: { type: "rule", values: rules },
    resultTypes: ["violations"],
    elementRef: false,
  });

  const pathOf = (el: Element): number[] | null => {
    const out: number[] = [];
    let cur: Element | null = el;
    while (cur && cur !== document.documentElement) {
      const parent: Element | null = cur.parentElement;
      if (!parent) return null; // detached or inside shadow DOM
      out.unshift(Array.prototype.indexOf.call(parent.children, cur));
      cur = parent;
    }
    return cur === document.documentElement ? out : null;
  };

  const chainOf = (el: Element): string[] => {
    const out: string[] = [];
    let cur = el.parentElement;
    while (cur && cur !== document.documentElement) {
      out.push(cur.tagName.toLowerCase() + (cur.id ? `#${cur.id}` : ""));
      cur = cur.parentElement;
    }
    return out;
  };

  type AxeCheck = { id: string; message: string; data: unknown };
  type AxeNode = {
    target: unknown[];
    html: string;
    failureSummary?: string;
    any: AxeCheck[];
    all: AxeCheck[];
    none: AxeCheck[];
  };
  type AxeViolation = {
    id: string;
    tags: string[];
    impact: Impact | null;
    help: string;
    description: string;
    helpUrl: string;
    nodes: AxeNode[];
  };

  const violations: RawViolation[] = (result.violations as AxeViolation[]).map((v) => ({
    ruleId: v.id,
    tags: v.tags,
    impact: v.impact,
    help: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map((n) => {
      const sel = n.target.length === 1 && typeof n.target[0] === "string" ? n.target[0] : null;
      const el = sel ? document.querySelector(sel) : null;
      const inSubset = args.subset.includes(v.id);
      return {
        selector: sel ?? JSON.stringify(n.target),
        path: el ? pathOf(el) : null,
        html: n.html,
        failureSummary: n.failureSummary ?? "",
        ancestorChain: el ? chainOf(el) : [],
        checks: [...n.any, ...n.all, ...n.none].map((c) => ({
          id: c.id,
          message: c.message,
          data: c.data ?? null,
        })),
        context: el && inSubset ? extractContext(el, v.id) : null,
      };
    }),
  }));

  return { version: axe.version as string, violations };
}
