// The accessibility-tree, focus-order and visual checks catch fake fixes that
// axe and the static suspicion heuristics both let through, and do not flag
// honest fixes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DEEP_CHECKS,
  auditSource,
  closeBrowser,
  probeOptions,
  suspicionReasons,
  validatePatch,
  verifyPatch,
  type AuditResult,
  type Finding,
} from "verifa11y-core";
import { createCoreRegistry } from "verifa11y-rules-core";

const registry = createCoreRegistry();
const file = fileURLToPath(new URL("./fixtures/deep-cases.html", import.meta.url));
let src = "";
let baseline: AuditResult;
after(() => closeBrowser());
before(async () => {
  src = await readFile(file, "utf8");
  baseline = await auditSource(file, src, { rules: registry.axeIds(), probe: probeOptions(DEFAULT_DEEP_CHECKS) });
});

function finding(ruleId: string, snippet: string): Finding {
  const f = baseline.findings.find((x) => x.ruleId === ruleId && (x.sourceSnippet ?? x.outerHTML).includes(snippet));
  assert.ok(f, `fixture has a ${ruleId} finding on ${snippet}`);
  return f;
}

async function run(f: Finding, before_: string, after_: string) {
  const patch = { findingId: f.id, rationale: "test", before: before_, after: after_, confidence: "high" };
  const v = await verifyPatch({ file, src, finding: f, patch, baseline, rule: registry.forFinding(f), checks: DEFAULT_DEEP_CHECKS });
  const shape = validatePatch(src, f, patch);
  const staticReasons = shape.ok ? suspicionReasons(src, shape.applied, f) : ["(invalid)"];
  return { v: v.verification, staticReasons };
}

describe("deep checks: fakes that only the new checks catch", () => {
  it("accessibility tree: an image named 'image' through aria-labelledby", async () => {
    const f = finding("image-alt", "kettle.png");
    const { v, staticReasons } = await run(f, '<img src="kettle.png" width="120" height="80">', '<img src="kettle.png" width="120" height="80" aria-labelledby="cap">');
    assert.deepEqual(staticReasons, [], "static heuristics do not see it");
    assert.equal(v.ruleGone, true, "axe is satisfied");
    assert.equal(v.status, "rejected_suspicious");
    assert.match(v.reason ?? "", /accessibility tree: .*generic name "image"/);
  });

  it("focus order: a fixed role that left the tab order", async () => {
    const f = finding("aria-roles", "buton");
    const { v, staticReasons } = await run(f, '<div role="buton" tabindex="0" style="padding: 12px">Buy</div>', '<div role="button" tabindex="-1" style="padding: 12px">Buy</div>');
    assert.deepEqual(staticReasons, []);
    assert.equal(v.ruleGone, true);
    assert.equal(v.status, "rejected_suspicious");
    assert.match(v.reason ?? "", /focus order: removed from the tab order: <div>/);
  });

  it("accessibility tree: a state dropped instead of corrected", async () => {
    const f = finding("aria-valid-attr-value", "aria-expanded");
    const { v, staticReasons } = await run(f, '<button aria-expanded="yes">Filters</button>', "<button>Filters</button>");
    assert.deepEqual(staticReasons, []);
    assert.equal(v.ruleGone, true);
    assert.equal(v.status, "rejected_suspicious");
    assert.match(v.reason ?? "", /lost its expanded state/);
  });

  it("visual: a contrast fix that repaints the whole page", async () => {
    const f = finding("color-contrast", "Prices include VAT");
    const { v, staticReasons } = await run(
      f,
      "<style>.muted { color: #999; }</style>",
      "<style>.muted { color: #999; } * { color: #000 !important; background: #fff !important; }</style>",
    );
    assert.deepEqual(staticReasons, []);
    assert.equal(v.ruleGone, true);
    assert.equal(v.status, "rejected_suspicious");
    assert.match(v.reason ?? "", /visual \(desktop\): .*% of the page changed outside the patched elements/);
  });

  it("inert: caught by the static check and, independently, by the tree and focus comparisons", async () => {
    const f = finding("label", 'name="contact"');
    const { v, staticReasons } = await run(f, '<input type="text" name="contact">', '<input type="text" name="contact" aria-label="Contact" inert>');
    assert.deepEqual(staticReasons, ["added inert"]);
    assert.equal(v.status, "rejected_suspicious", `${v.status}: ${v.reason}`);
    assert.match(v.reason ?? "", /accessibility tree: <input> .*(was removed|no longer exposed)/);
    assert.match(v.reason ?? "", /focus order: removed from the tab order: <input>/);
  });
});

describe("deep checks: honest fixes pass", () => {
  const cases: Array<[string, string, string, string]> = [
    ["image-alt", '<img src="kettle.png" width="120" height="80">', '<img src="kettle.png" width="120" height="80" alt="Stainless steel electric kettle">', "kettle.png"],
    ["aria-roles", '<div role="buton" tabindex="0" style="padding: 12px">Buy</div>', '<div role="button" tabindex="0" style="padding: 12px">Buy</div>', "buton"],
    ["aria-valid-attr-value", '<button aria-expanded="yes">Filters</button>', '<button aria-expanded="true">Filters</button>', "aria-expanded"],
    ["color-contrast", "<style>.muted { color: #999; }</style>", "<style>.muted { color: #595959; }</style>", "Prices include VAT"],
    ["label", "<p>Contact</p>\n  <input type=\"text\" name=\"contact\">", "<label>Contact\n  <input type=\"text\" name=\"contact\"></label>", 'name="contact"'],
  ];
  for (const [rule, b, a, snippet] of cases) {
    it(`${rule}`, async () => {
      const { v } = await run(finding(rule, snippet), b, a);
      assert.equal(v.status, "verified", v.reason ?? "");
      assert.ok(v.checks?.ax && v.checks.focus && v.checks.visual, "every check ran");
    });
  }
});
