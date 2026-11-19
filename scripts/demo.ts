// Regenerates demo/after from demo/before: audit, fix, verify, combine.
//
//   npm run demo                 # uses Claude if ANTHROPIC_API_KEY is set, else the heuristic baseline
//   npm run demo -- heuristic    # force the offline baseline

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditFile } from "../src/audit.ts";
import { closeBrowser } from "../src/browser.ts";
import { HeuristicGenerator, LlmGenerator, type Generator } from "../src/generate.ts";
import { countBy, limiter, processPage, writeJson } from "../src/pipeline.ts";

const BEFORE = "demo/before/index.html";
const AFTER_DIR = "demo/after";

const forceHeuristic = process.argv.includes("heuristic");
const generator: Generator =
  !forceHeuristic && process.env.ANTHROPIC_API_KEY ? new LlmGenerator() : new HeuristicGenerator();

try {
  const audit = await auditFile(BEFORE);
  console.log(`${audit.findings.length} finding(s); generating with ${generator.name}`);
  const page = await processPage(
    BEFORE,
    audit.findings,
    { generator, verify: true, genLimit: limiter(4), auditLimit: limiter(4), log: console.log },
    audit,
  );
  await mkdir(AFTER_DIR, { recursive: true });
  await writeFile(path.join(AFTER_DIR, "index.html"), page.combined ?? "", "utf8");
  const accepted = page.outcomes.filter((o) => o.verification.status === "verified");
  await writeFile(path.join(AFTER_DIR, "accepted.diff"), accepted.map((o) => o.verification.diff).join("\n"), "utf8");
  await writeJson(
    path.join(AFTER_DIR, "results.json"),
    page.outcomes.map((o) => ({
      findingId: o.finding.id,
      ruleId: o.finding.ruleId,
      line: o.finding.sourceLines?.start ?? null,
      status: o.verification.status,
      reason: o.verification.reason,
      patch: o.generation.patch,
    })),
  );
  const statuses = countBy(page.outcomes.map((o) => o.verification.status));
  await writeFile(
    path.join(AFTER_DIR, "GENERATED_BY.md"),
    `# How demo/after was produced\n\n` +
      `- Generator: \`${generator.name}\`\n` +
      `- Date: ${new Date().toISOString().slice(0, 10)}\n` +
      `- Findings in demo/before: ${audit.findings.length}\n` +
      `- Outcomes: ${Object.entries(statuses).map(([k, v]) => `${k} ${v}`).join(", ")}\n` +
      `- Subset violations left in demo/after: ${page.remaining?.length ?? "n/a"}\n\n` +
      `\`index.html\` is demo/before with every verified patch applied. \`accepted.diff\` lists those patches;\n` +
      `\`results.json\` has every patch, including the rejected ones and why. Regenerate with \`npm run demo\`.\n`,
    "utf8",
  );
  console.log(JSON.stringify(statuses));
} finally {
  await closeBrowser();
}
