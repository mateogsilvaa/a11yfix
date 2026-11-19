#!/usr/bin/env node
// a11yfix command-line interface.

import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Command, InvalidArgumentError, Option } from "commander";
import { auditFile, auditSource } from "./audit.js";
import { closeBrowser } from "./browser.js";
import { DEFAULT_MODEL, HeuristicGenerator, LlmGenerator, type Effort, type Generator } from "./generate.js";
import { countBy, limiter, processPage, writeJson, writePageArtifacts, type PageOutcome } from "./pipeline.js";
import { metricsFile, renderReport, type MetricsFile } from "./report.js";
import { RULE_IDS, rulesForLevel } from "./rules.js";
import type { Finding } from "./types.js";
import { verifyPatch } from "./verify.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const int = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError("must be a positive integer");
  return n;
};

function makeGenerator(kind: string, model: string, effort: Effort): Generator {
  if (kind === "heuristic") return new HeuristicGenerator();
  try {
    return new LlmGenerator({ model, effort });
  } catch (err) {
    throw new Error(
      `Could not create the Anthropic client (${(err as Error).message}).\n` +
        `Set ANTHROPIC_API_KEY, or run with --generator heuristic to use the offline baseline.`,
    );
  }
}

async function readFindings(file: string): Promise<Finding[]> {
  const data = JSON.parse(await readFile(file, "utf8")) as unknown;
  if (!Array.isArray(data)) throw new Error(`${file}: expected an array of findings`);
  return data as Finding[];
}

function groupByFile(findings: Finding[]): Map<string, Finding[]> {
  const out = new Map<string, Finding[]>();
  for (const f of findings) out.set(f.sourceFile, [...(out.get(f.sourceFile) ?? []), f]);
  return out;
}

async function listHtml(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listHtml(p)));
    else if (/\.html?$/i.test(entry.name)) out.push(p);
  }
  return out.sort();
}

const program = new Command()
  .name("a11yfix")
  .description("Audit HTML for accessibility violations, patch them, and keep only the patches a re-audit proves correct.")
  .version(pkg.version);

const generatorOpts = (cmd: Command) =>
  cmd
    .addOption(new Option("--generator <kind>", "patch generator").choices(["llm", "heuristic"]).default("llm"))
    .option("--model <id>", "Claude model id", DEFAULT_MODEL)
    .addOption(new Option("--effort <level>", "model effort").choices(["low", "medium", "high", "xhigh", "max"]).default("medium"))
    .option("--concurrency <n>", "parallel model calls", int, 4);

program
  .command("audit")
  .description("audit an HTML file and write normalized findings")
  .argument("<file>", "HTML file")
  .option("--out <file>", "findings output", "findings.json")
  .addOption(new Option("--level <n>", "1 = structural rules, 2 = also color-contrast").choices(["1", "2"]).default("2"))
  .action(async (file: string, o: { out: string; level: "1" | "2" }) => {
    const r = await auditFile(file, { rules: rulesForLevel(Number(o.level) as 1 | 2) });
    await writeJson(o.out, r.findings);
    const by = countBy(r.findings.map((f) => f.ruleId));
    console.log(`${r.findings.length} finding(s) in ${file} (${(r.ms / 1000).toFixed(1)} s, axe ${r.axeVersion})`);
    for (const [rule, n] of Object.entries(by)) console.log(`  ${rule}: ${n}`);
    console.log(`wrote ${o.out}`);
  });

generatorOpts(
  program
    .command("fix")
    .description("generate a patch per finding; with --verify, keep only re-audited ones")
    .argument("<findings>", "findings.json from `audit`")
    .option("--out <dir>", "output directory", "patches")
    .option("--verify", "re-audit every patch (off by default only to save time while developing)", false)
    .option("--limit <n>", "only the first N findings per file", int),
).action(
  async (
    findingsFile: string,
    o: { out: string; verify: boolean; limit?: number; generator: string; model: string; effort: Effort; concurrency: number },
  ) => {
    const generator = makeGenerator(o.generator, o.model, o.effort);
    const groups = groupByFile(await readFindings(findingsFile));
    const genLimit = limiter(o.concurrency);
    const auditLimit = limiter(Math.max(2, Math.min(o.concurrency, 6)));
    for (const [file, findings] of groups) {
      console.log(`${file}: ${findings.length} finding(s) with ${generator.name}${o.verify ? ", verifying" : ""}`);
      const page = await processPage(file, findings, { generator, verify: o.verify, limit: o.limit, genLimit, auditLimit, log: console.log });
      const dir = groups.size > 1 ? path.join(o.out, path.basename(file, path.extname(file))) : o.out;
      await writePageArtifacts(dir, page);
      const st = countBy(page.outcomes.map((x) => x.verification.status));
      console.log(`  ${JSON.stringify(st)}${page.remaining ? `; ${page.remaining.length} subset violation(s) left after combining` : ""}`);
      console.log(`  wrote ${dir}`);
    }
  },
);

program
  .command("verify")
  .description("verify one patch against a file")
  .argument("<file>", "HTML file the patch applies to")
  .argument("<patch>", "patch.json")
  .option("--findings <file>", "findings.json the patch refers to (default: re-audit the file)")
  .option("--out <file>", "write verification.json here")
  .action(async (file: string, patchFile: string, o: { findings?: string; out?: string }) => {
    const src = await readFile(file, "utf8");
    const patch = JSON.parse(await readFile(patchFile, "utf8")) as { findingId?: string };
    const baseline = await auditSource(file, src);
    const findings = o.findings ? await readFindings(o.findings) : baseline.findings;
    const finding = findings.find((f) => f.id === patch.findingId);
    if (!finding) throw new Error(`finding ${patch.findingId} not found ${o.findings ? `in ${o.findings}` : `in a fresh audit of ${file}`}`);
    const { verification } = await verifyPatch({ file, src, finding, patch, baseline });
    const { diff, ...rest } = verification;
    console.log(JSON.stringify(rest, null, 2));
    if (diff) console.log(`\n${diff}`);
    if (o.out) await writeJson(o.out, rest);
    process.exitCode = verification.status === "verified" ? 0 : 1;
  });

generatorOpts(
  program
    .command("bench")
    .description("run audit + fix + verify over a corpus and write a report")
    .option("--corpus <dir>", "directory of HTML pages (searched recursively)", "corpus")
    .option("--report <file>", "markdown report", "report.md")
    .option("--out <dir>", "per-page artifacts", "bench/run")
    .option("--limit <n>", "only the first N findings per page", int)
    .option("--pages <n>", "only the first N pages", int)
    .option("--notes <file>", "markdown appended to the report (analysis)")
    .option("--compare <file>", "metrics.json of another run to compare against"),
).action(
  async (o: {
    corpus: string;
    report: string;
    out: string;
    limit?: number;
    pages?: number;
    notes?: string;
    compare?: string;
    generator: string;
    model: string;
    effort: Effort;
    concurrency: number;
  }) => {
    const generator = makeGenerator(o.generator, o.model, o.effort);
    const compare = o.compare ? (JSON.parse(await readFile(o.compare, "utf8")) as MetricsFile) : undefined;
    if (!(await stat(o.corpus)).isDirectory()) throw new Error(`${o.corpus} is not a directory`);
    let files = await listHtml(o.corpus);
    if (o.pages) files = files.slice(0, o.pages);
    const started = Date.now();
    const genLimit = limiter(o.concurrency);
    const auditLimit = limiter(4);
    const pageLimit = limiter(2);
    let axeVersion = "";

    console.log(`bench: ${files.length} page(s), generator ${generator.name}`);
    const pages: PageOutcome[] = await Promise.all(
      files.map((file) =>
        pageLimit(async () => {
          const baseline = await auditLimit(() => auditFile(file, { rules: RULE_IDS }));
          axeVersion = baseline.axeVersion;
          const page = await processPage(file, baseline.findings, { generator, verify: true, limit: o.limit, genLimit, auditLimit }, baseline);
          const rel = path.relative(o.corpus, file).replace(/\.html?$/i, "").split(path.sep).join("/");
          await writePageArtifacts(path.join(o.out, rel), page);
          const st = countBy(page.outcomes.map((x) => x.verification.status));
          console.log(`  ${rel}: ${page.findings.length} finding(s) ${JSON.stringify(st)} in ${(page.ms / 1000).toFixed(1)} s`);
          return page;
        }),
      ),
    );

    const notes = o.notes ? await readFile(o.notes, "utf8") : undefined;
    // Keep page order stable regardless of completion order.
    pages.sort((a, b) => a.file.localeCompare(b.file));
    const input = {
      generator: generator.name,
      model: o.generator === "llm" ? o.model : null,
      corpus: o.corpus,
      pages,
      axeVersion,
      wallMs: Date.now() - started,
      date: new Date().toISOString().slice(0, 10),
      notes,
      compare,
    };
    await mkdir(path.dirname(path.resolve(o.report)), { recursive: true });
    await writeFile(o.report, renderReport(input), "utf8");
    await writeJson(path.join(o.out, "metrics.json"), metricsFile(input));
    console.log(`wrote ${o.report} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  },
);

program
  .parseAsync()
  .catch((err: Error) => {
    console.error(`a11yfix: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
