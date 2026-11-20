// Tier-0 codemods: what they fix, and, as importantly, what they decline.
// Each produced patch is verified against a real browser.
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RuleRegistry, auditSource, closeBrowser, defineRule, runCodemod, verifyPatch, type Rule } from "verifa11y-core";
import { coreRules, createCoreRegistry } from "verifa11y-rules-core";

const registry = createCoreRegistry();
after(() => closeBrowser());

const page = (body: string, head = "") =>
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>t</title>\n${head}</head>\n<body>\n<main>\n${body}\n</main>\n</body>\n</html>\n`;

/** Audit `html`, run the codemod for the first finding of `rule`, verify the result. */
async function codemod(html: string, rule: string, nth = 0) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "verifa11y-"));
  const file = path.join(dir, "page.html");
  await writeFile(file, html, "utf8");
  const baseline = await auditSource(file, html, { rules: registry.axeIds() });
  const f = baseline.findings.filter((x) => x.ruleId === rule)[nth];
  assert.ok(f, `no ${rule} finding`);
  const r = registry.forFinding(f)!;
  const g = runCodemod(r, f, html);
  if (!g.patch) return { patch: null, status: "declined" as const, reason: g.error };
  const { verification } = await verifyPatch({ file, src: html, finding: f, patch: g.patch, baseline, rule: r });
  return { patch: g.patch, status: verification.status, reason: verification.reason };
}

describe("label", () => {
  it("wraps a bare text label and its control", async () => {
    const r = await codemod(page(`<div>\n  Full name\n  <input type="text" name="fullname">\n</div>`), "label");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /^<label>Full name[\s\S]*<\/label>$/);
  });

  it("wraps a checkbox and the text after it", async () => {
    const r = await codemod(page(`<p><input type="checkbox" name="news"> Send me news</p>`), "label");
    assert.equal(r.status, "verified", r.reason ?? "");
  });

  it("points aria-labelledby at a text element", async () => {
    const r = await codemod(page(`<div>\n  <span>Postcode</span>\n  <input type="text" name="postcode">\n</div>`), "label");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /id="postcode-label"[\s\S]*aria-labelledby="postcode-label"/);
  });

  it("uses the previous table cell", async () => {
    const r = await codemod(page(`<table><tr><td>Email</td><td><input type="email" name="email"></td></tr></table>`), "label");
    assert.equal(r.status, "verified", r.reason ?? "");
  });

  it("declines two controls under one label", async () => {
    const r = await codemod(
      page(`<table><tr><td>Name</td><td><input type="text" name="first"> <input type="text" name="last"></td></tr></table>`),
      "label",
    );
    assert.equal(r.status, "declined");
  });

  it("declines a control with no nearby text", async () => {
    const r = await codemod(page(`<div><input type="text" name="q"></div>`), "label");
    assert.equal(r.status, "declined");
  });
});

describe("heading-order", () => {
  it("re-levels the target", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<h3>B</h3>\n<p>x</p>`), "heading-order");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.equal(r.patch!.after, "<h2>B</h2>");
  });

  it("also re-levels a sibling the change would break", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<h4>B</h4>\n<p>x</p>\n<h4>C</h4>`), "heading-order");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /<h2>B<\/h2>[\s\S]*<h2>C<\/h2>/);
  });

  it("keeps siblings as siblings", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<h3>B</h3>\n<p>x</p>\n<h3>C</h3>`), "heading-order");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /<h2>B<\/h2>[\s\S]*<h2>C<\/h2>/);
  });

  it("declines when keeping the outline would need too large a patch", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<h3>B</h3>\n<p>x</p>\n<h3>C</h3>\n<p>x</p>\n<h3>D</h3>`), "heading-order");
    assert.equal(r.status, "declined");
  });

  it("keeps a child one level below its re-levelled parent", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<h4>B</h4>\n<h5>C</h5>`), "heading-order");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /<h2>B<\/h2>\n<h3>C<\/h3>/);
  });

  it("leaves a heading that already skipped a level to its own finding", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<h3>B</h3>\n<h5>C</h5>`), "heading-order");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.equal(r.patch!.after, "<h2>B</h2>");
  });

  it("declines when the page uses role=heading", async () => {
    const r = await codemod(page(`<h1>A</h1>\n<div role="heading" aria-level="2">x</div>\n<h4>B</h4>`), "heading-order");
    assert.equal(r.status, "declined");
  });
});

describe("aria-roles", () => {
  it("corrects a misspelled role", async () => {
    const r = await codemod(page(`<div role="navigaton"><a href="/">Home</a></div>`), "aria-roles");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /role="navigation"/);
  });

  it("declines an abstract role", async () => {
    const r = await codemod(page(`<div role="range">50%</div>`), "aria-roles");
    assert.equal(r.status, "declined");
  });

  it("declines a correction that needs a state the element lacks", async () => {
    const r = await codemod(page(`<div role="chekbox" tabindex="0">Accept</div>`), "aria-roles");
    assert.equal(r.status, "declined");
  });
});

describe("aria-allowed-attr", () => {
  it("removes a property the role does not support", async () => {
    const r = await codemod(page(`<div aria-level="2">Advanced</div>`), "aria-allowed-attr");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.equal(r.patch!.after, "<div>");
  });

  it("declines a misplaced state (intent needs judgment)", async () => {
    const r = await codemod(page(`<button type="button" aria-checked="false">Dark mode</button>`), "aria-allowed-attr");
    assert.equal(r.status, "declined");
  });
});

describe("aria-valid-attr-value", () => {
  it("maps yes/no style booleans", async () => {
    const r = await codemod(page(`<button type="button" aria-expanded="yes">More</button>`), "aria-valid-attr-value");
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /aria-expanded="true"/);
  });

  it("fixes a near-miss id reference", async () => {
    const r = await codemod(
      page(`<button type="button" aria-expanded="true" aria-controls="privcy-panel">Privacy</button>\n<div id="privacy-panel"><p>x</p></div>`),
      "aria-valid-attr-value",
    );
    assert.equal(r.status, "verified", r.reason ?? "");
    assert.match(r.patch!.after, /aria-controls="privacy-panel"/);
  });

  it("declines an unknown token", async () => {
    const r = await codemod(page(`<div aria-live="loud">Saved</div>`), "aria-valid-attr-value");
    assert.equal(r.status, "declined");
  });

  it('never turns an invalid aria-hidden into "true"', async () => {
    const r = await codemod(page(`<p aria-hidden="yes">Hidden?</p>`), "aria-valid-attr-value");
    assert.equal(r.status, "declined");
  });
});

describe("rule registry", () => {
  it("registers every core rule with a unique axe rule", () => {
    assert.equal(registry.all().length, coreRules.length);
    assert.deepEqual(new Set(registry.axeIds()).size, coreRules.length);
  });

  it("tier-1 rules have no codemod, tier-0 rules have one", () => {
    for (const r of coreRules) assert.equal(Boolean(r.fix), r.tier === 0, r.id);
  });

  it("rejects malformed rules", () => {
    const base: Rule = { ...coreRules[0]!, id: "x-test" };
    assert.throws(() => defineRule({ ...base, id: "Not Kebab" }), /kebab/);
    assert.throws(() => defineRule({ ...base, version: "1" }), /semver/);
    assert.throws(() => defineRule({ ...base, tier: 0, fix: undefined }), /tier-0/);
    assert.throws(() => new RuleRegistry([...coreRules, { ...coreRules[0]!, id: "dup" }]), /both claim/);
  });
});
