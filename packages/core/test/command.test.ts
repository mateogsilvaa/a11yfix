// Tier 1 through an arbitrary command: any agent or model CLI can propose
// patches, and the verifier judges them exactly like the built-in client's.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CommandGenerator, auditSource, closeBrowser, extractPatch, limiter, processPage } from "a11yfix-core";
import { createCoreRegistry } from "a11yfix-rules-core";

const registry = createCoreRegistry();
after(() => closeBrowser());

const mini = fileURLToPath(new URL("./fixtures/mini.html", import.meta.url));
const agent = fileURLToPath(new URL("./fixtures/agents/alt-agent.mjs", import.meta.url));
const cmd = (mode: string) => `"${process.execPath}" "${agent}" ${mode}`;

async function imageFinding() {
  const src = await readFile(mini, "utf8");
  const audit = await auditSource(mini, src, { rules: registry.axeIds() });
  const f = audit.findings.find((x) => x.ruleId === "image-alt");
  assert.ok(f, "mini.html has an image-alt finding");
  return { src, audit, f };
}

describe("extractPatch", () => {
  const p = { findingId: "f_0001", rationale: "r", before: "<a>", after: "<b>", confidence: "low" };
  it("accepts bare JSON", () => assert.equal(extractPatch(JSON.stringify(p)).ok, true));
  it("accepts JSON inside prose and fences, with braces in strings", () => {
    const q = { ...p, before: "<style>a { color: red }</style>" };
    const r = extractPatch(`Here you go {not this}:\n\`\`\`json\n${JSON.stringify(q)}\n\`\`\`\nbye }`);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.patch.before, q.before);
  });
  it("reports schema errors", () => {
    const r = extractPatch(JSON.stringify({ findingId: "x" }));
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.reason : "", /schema/);
  });
  it("rejects empty output", () => assert.equal(extractPatch("  ").ok, false));
});

describe("CommandGenerator", () => {
  it("gets a patch from a chatty agent CLI (text input)", async () => {
    const { src, f } = await imageFinding();
    const g = await new CommandGenerator({ command: cmd("good") }).generate(f, src);
    assert.equal(g.error, null);
    assert.equal(g.tier, 1);
    assert.equal(g.patch?.after, '<img src="chart.png" alt="Bar chart of sales by quarter">');
  });

  it("supports the json input format", async () => {
    const { src, f } = await imageFinding();
    const g = await new CommandGenerator({ command: cmd("json"), input: "json" }).generate(f, src);
    assert.equal(g.error, null);
    assert.equal(g.patch?.findingId, f.id);
  });

  it("retries with feedback after invalid output", async () => {
    const { src, f } = await imageFinding();
    const g = await new CommandGenerator({ command: cmd("flaky") }).generate(f, src);
    assert.equal(g.error, null);
    assert.equal(g.attempts, 2);
  });

  it("gives up after the retries", async () => {
    const { src, f } = await imageFinding();
    const g = await new CommandGenerator({ command: cmd("silent"), maxRetries: 1 }).generate(f, src);
    assert.equal(g.patch, null);
    assert.equal(g.attempts, 2);
    assert.match(g.error ?? "", /empty output/);
  });

  it("is verified like any other tier-1 patch: a good alt is kept, a lazy one is not", async () => {
    const { audit, f } = await imageFinding();
    const run = async (mode: string) => {
      const page = await processPage(mini, [f], {
        registry,
        mode: "auto",
        llm: new CommandGenerator({ command: cmd(mode) }),
        verify: true,
        strict: true,
        genLimit: limiter(1),
        auditLimit: limiter(2),
      }, audit);
      return page.outcomes[0]!;
    };
    const good = await run("good");
    assert.equal(good.verification.status, "verified", good.verification.reason ?? "");
    assert.equal(good.included, true);
    const lazy = await run("lazy");
    assert.equal(lazy.verification.status, "rejected_suspicious");
    assert.equal(lazy.included, false);
  });
});
