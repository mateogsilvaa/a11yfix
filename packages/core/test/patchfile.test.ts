// The output patch must apply with plain `git apply`, including on CRLF files,
// and --strict must keep suspicious patches out of it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { auditSource, closeBrowser, combine, gitPatch, limiter, processPage, type Generator, type PatchOutcome } from "a11yfix-core";
import { createCoreRegistry } from "a11yfix-rules-core";

const registry = createCoreRegistry();
after(() => closeBrowser());

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

async function repoWith(name: string, source: string, crlf: boolean) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "a11yfix-git-"));
  git(dir, "init", "-q");
  git(dir, "config", "core.autocrlf", "false");
  await writeFile(path.join(dir, ".gitattributes"), "* -text\n");
  await copyFile(source, path.join(dir, name));
  if (crlf) {
    const lf = (await readFile(path.join(dir, name), "utf8")).replace(/\r\n/g, "\n");
    await writeFile(path.join(dir, name), lf.replace(/\n/g, "\r\n"));
  }
  return dir;
}

describe("git patch output", () => {
  for (const [page, crlf] of [["02-newsletter-labels.html", false], ["02-newsletter-labels.html", true]] as const) {
    it(`applies with git apply: ${page}${crlf ? " (CRLF copy)" : ""}`, async () => {
      const source = fileURLToPath(new URL(`../../../corpus/handwritten/${page}`, import.meta.url));
      const dir = await repoWith(page, source, crlf);
      const file = path.join(dir, page);
      const out = await processPage(file, (await auditSource(file, await readFile(file, "utf8"), { rules: registry.axeIds() })).findings, {
        registry,
        mode: "codemod",
        llm: null,
        verify: true,
        strict: false,
        genLimit: limiter(2),
        auditLimit: limiter(2),
      });
      const patch = gitPatch([{ path: page, before: out.src, after: out.combined! }]);
      assert.ok(patch.startsWith(`diff --git a/${page} b/${page}`));
      await writeFile(path.join(dir, "fix.patch"), patch);
      git(dir, "apply", "--check", "fix.patch");
      git(dir, "apply", "fix.patch");
      assert.equal(await readFile(file, "utf8"), out.combined);
    });
  }
});

describe("combine", () => {
  const src = "<h3>A</h3>\n<div role=\"buton\">x</div>\n<h3>B</h3>\n";
  const outcome = (id: string, before: string, after: string): PatchOutcome => {
    const start = src.indexOf(before);
    return {
      finding: { id } as PatchOutcome["finding"],
      generation: {} as PatchOutcome["generation"],
      verification: {} as PatchOutcome["verification"],
      verified: true,
      included: true,
      editStart: start,
      editEndOld: start + before.length,
      after,
    };
  };

  it("applies a multi-line patch and a patch nested inside its span", () => {
    const heading = outcome("h", src.slice(0, src.indexOf("\n", src.indexOf("B"))), "<h2>A</h2>\n<div role=\"buton\">x</div>\n<h2>B</h2>");
    const role = outcome("r", '<div role="buton">', '<div role="button">');
    const { text, skipped } = combine(src, [heading, role]);
    assert.deepEqual(skipped, []);
    assert.equal(text, '<h2>A</h2>\n<div role="button">x</div>\n<h2>B</h2>\n');
  });

  it("skips a conflicting patch as a whole, never half of it", () => {
    const a = outcome("a", "<h3>A</h3>", "<h2>A</h2>");
    const b = outcome("b", src.slice(0, src.indexOf("\n", src.indexOf("B"))), "<h4>A</h4>\n<div role=\"buton\">x</div>\n<h4>B</h4>");
    const { text, skipped } = combine(src, [a, b]);
    assert.deepEqual(skipped, ["b"]);
    assert.equal(text, src.replace("<h3>A</h3>", "<h2>A</h2>"));
  });
});

describe("--strict", () => {
  // A fake tier-1 generator that always returns a suspicious (generic) alt.
  const generic: Generator = {
    name: "fake",
    async generate(f, src) {
      const before = f.sourceSnippet!;
      return {
        patch: { findingId: f.id, rationale: "x", before, after: before.replace(/<img/, '<img alt="image"'), confidence: "low" },
        error: null,
        attempts: 1,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        ms: 0,
        tier: 1,
      };
      void src;
    },
  };

  it("includes suspicious patches by default and leaves them out with --strict", async () => {
    const file = fileURLToPath(new URL("./fixtures/verify-cases.html", import.meta.url));
    const src = await readFile(file, "utf8");
    const findings = (await auditSource(file, src, { rules: registry.axeIds() })).findings.filter((f) => f.ruleId === "image-alt" && f.sourceLines?.start === 12);
    const opts = { registry, mode: "auto" as const, llm: generic, verify: true, genLimit: limiter(1), auditLimit: limiter(1) };
    const lax = await processPage(file, findings, { ...opts, strict: false });
    const strict = await processPage(file, findings, { ...opts, strict: true });
    assert.equal(lax.outcomes[0]!.verification.status, "rejected_suspicious");
    assert.equal(lax.outcomes[0]!.included, true);
    assert.match(lax.combined!, /alt="image"/);
    assert.equal(strict.outcomes[0]!.included, false);
    assert.equal(strict.combined, src);
  });
});
