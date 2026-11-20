// Regenerates demo/after from demo/before: audit, fix, verify, combine.
//
//   npm run demo                 # tier 0, plus the model for judgment cases if ANTHROPIC_API_KEY is set
//   npm run demo -- codemod      # tier 0 only (no model, no network)

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_DEEP_CHECKS, LlmGenerator, auditFile, closeBrowser, countBy, limiter, pagePatch, processPage, writeJson } from "a11yfix-core";
import { createCoreRegistry } from "a11yfix-rules-core";

const BEFORE = "demo/before/index.html";
const AFTER_DIR = "demo/after";

const registry = createCoreRegistry();
const codemodOnly = process.argv.includes("codemod") || !process.env.ANTHROPIC_API_KEY;
const llm = codemodOnly ? null : new LlmGenerator();

try {
  const audit = await auditFile(BEFORE, { rules: registry.axeIds() });
  console.log(`${audit.findings.length} finding(s); ${llm ? `tier 0 + ${llm.name}` : "tier 0 only"}`);
  const page = await processPage(
    BEFORE,
    audit.findings,
    {
      registry,
      mode: llm ? "auto" : "codemod",
      llm,
      verify: true,
      strict: true,
      checks: DEFAULT_DEEP_CHECKS,
      genLimit: limiter(4),
      auditLimit: limiter(4),
      log: console.log,
    },
    audit,
  );
  await mkdir(AFTER_DIR, { recursive: true });
  await writeFile(path.join(AFTER_DIR, "index.html"), page.combined ?? "", "utf8");
  await writeFile(path.join(AFTER_DIR, "a11yfix.patch"), pagePatch(page), "utf8");
  await writeJson(
    path.join(AFTER_DIR, "results.json"),
    page.outcomes.map((o) => ({
      findingId: o.finding.id,
      ruleId: o.finding.ruleId,
      line: o.finding.sourceLines?.start ?? null,
      tier: o.generation.patch ? o.generation.tier : null,
      status: o.verification.status,
      reason: o.verification.reason,
      patch: o.generation.patch,
    })),
  );
  const statuses = countBy(page.outcomes.map((o) => o.verification.status));
  await writeFile(
    path.join(AFTER_DIR, "GENERATED_BY.md"),
    `# How demo/after was produced\n\n` +
      `- Mode: ${llm ? `tier 0 codemods + tier 1 \`${llm.name}\`` : "tier 0 codemods only (no model)"}, strict\n` +
      `- Verifier: axe-core, static checks, accessibility tree, focus order, visual (desktop)\n` +
      `- Date: ${new Date().toISOString().slice(0, 10)}\n` +
      `- Findings in demo/before: ${audit.findings.length}\n` +
      `- Outcomes: ${Object.entries(statuses).map(([k, v]) => `${k} ${v}`).join(", ")}\n` +
      `- Violations of the patched rules left in demo/after: ${page.remaining?.length ?? "n/a"}\n\n` +
      `\`index.html\` is demo/before with every verified patch applied, and \`a11yfix.patch\` is the same change as a\n` +
      `patch (\`git apply\`). \`results.json\` has every finding, including the skipped and rejected ones and why.\n` +
      `Regenerate with \`npm run demo\`.\n`,
    "utf8",
  );
  console.log(JSON.stringify(statuses));
} finally {
  await closeBrowser();
}
