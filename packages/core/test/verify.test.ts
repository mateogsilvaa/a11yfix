// End-to-end tests for the verifier: real browser, real axe, hand-written patches.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { auditSource, closeBrowser, verifyPatch, type AuditResult, type Finding, type Patch } from "a11yfix-core";
import { createCoreRegistry } from "a11yfix-rules-core";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const RULES = createCoreRegistry().axeIds();
const FILE = fixture("verify-cases.html");
let src = "";
let baseline: AuditResult;

const findingAt = (rule: string, line: number): Finding => {
  const f = baseline.findings.find((x) => x.ruleId === rule && x.sourceLines?.start === line);
  assert.ok(f, `no ${rule} finding on line ${line}`);
  return f;
};

const run = async (f: Finding, beforeText: string, afterText: string) => {
  const patch: Patch = { findingId: f.id, rationale: "test", before: beforeText, after: afterText, confidence: "high" };
  return (await verifyPatch({ file: FILE, src, finding: f, patch, baseline })).verification;
};

const IMG = '<img src="q3-sales.png">';

before(async () => {
  src = await readFile(FILE, "utf8");
  baseline = await auditSource(FILE, src, { rules: RULES });
});
after(() => closeBrowser());

describe("audit", () => {
  it("maps findings to source lines", () => {
    const rules = baseline.findings.map((f) => `${f.ruleId}@${f.sourceLines?.start}`).sort();
    assert.deepEqual(rules, ["heading-order@15", "image-alt@10", "image-alt@12", "label@18", "label@19"].sort());
  });
});

describe("verifier accepts", () => {
  it("a real fix", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt="Bar chart: sales grew 12% in Q3">');
    assert.equal(v.status, "verified", v.reason ?? "");
    assert.equal(v.ruleGone, true);
  });

  it('alt="" for an image whose information is already in the caption', async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt="">');
    assert.equal(v.status, "verified", v.reason ?? "");
  });

  it("a heading fix that keeps the outline valid", async () => {
    const v = await run(
      findingAt("heading-order", 15),
      "<h4>Opening hours</h4>\n    <h5>Weekends</h5>",
      "<h2>Opening hours</h2>\n    <h3>Weekends</h3>",
    );
    assert.equal(v.status, "verified", v.reason ?? "");
  });

  it("a duplicated `before`, disambiguated by the target position", async () => {
    const v = await run(findingAt("label", 19), '<input type="text" name="q">', '<input type="text" name="q" aria-label="Search products">');
    assert.equal(v.status, "verified", v.reason ?? "");
  });
});

describe("verifier rejects as suspicious", () => {
  it("a generic alt", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt="image">');
    assert.equal(v.status, "rejected_suspicious");
  });

  it("a file-name alt", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt="q3-sales.png">');
    assert.equal(v.status, "rejected_suspicious");
  });

  it("an alt that only restates the file name", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt="Q3 sales">');
    assert.equal(v.status, "rejected_suspicious", v.reason ?? "");
  });

  it('aria-hidden="true"', async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" aria-hidden="true">');
    assert.equal(v.status, "rejected_suspicious");
  });

  it('role="presentation"', async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" role="presentation">');
    assert.equal(v.status, "rejected_suspicious");
  });

  it('alt="" on the only content of a link (link stays nameless; link-name was already failing)', async () => {
    const v = await run(findingAt("image-alt", 10), '<img src="logo.png">', '<img src="logo.png" alt="">');
    assert.equal(v.status, "rejected_suspicious", v.reason ?? "");
  });

  it("deleting an invalid role from a focusable element instead of correcting it", async () => {
    const file = fixture("mini.html");
    const msrc = await readFile(file, "utf8");
    const mbase = await auditSource(file, msrc, { rules: RULES });
    const f = mbase.findings.find((x) => x.ruleId === "aria-roles");
    assert.ok(f);
    const bad = await verifyPatch({
      file, src: msrc, finding: f, baseline: mbase,
      patch: { findingId: f.id, rationale: "t", before: '<div role="buton">', after: '<div tabindex="0">', confidence: "low" },
    });
    assert.equal(bad.verification.status, "rejected_suspicious", bad.verification.reason ?? "");
    const good = await verifyPatch({
      file, src: msrc, finding: f, baseline: mbase,
      patch: { findingId: f.id, rationale: "t", before: '<div role="buton">', after: '<div role="button" tabindex="0">', confidence: "high" },
    });
    // Correcting the role does not trip the heuristic. (In this tiny fixture the new
    // button sits right next to the <input>, so axe's target-size rule may still
    // report a regression; that is a real, separate finding.)
    assert.equal(good.verification.suspicious, false, good.verification.reason ?? "");
    assert.equal(good.verification.ruleGone, true);
  });

  it("making the content invisible with clip-path", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt="Sales chart" style="clip-path: inset(50%)">');
    assert.equal(v.status, "rejected_suspicious", v.reason ?? "");
  });

  it("deleting the element", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, "<span></span>");
    assert.equal(v.status, "rejected_suspicious");
  });
});

describe("verifier rejects as persisting or regressing", () => {
  it("a patch that does not remove the violation", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, '<img src="q3-sales.png" alt=" ">');
    assert.equal(v.status, "rejected_persists");
  });

  it("a fix that adds an invalid ARIA value", async () => {
    const v = await run(findingAt("label", 18), '<input type="text" name="q">', '<input type="text" name="q" aria-label="Search" aria-invalid="maybe-later">');
    assert.equal(v.status, "rejected_regression", v.reason ?? "");
    assert.ok(v.newViolations.some((x) => x.ruleId === "aria-valid-attr-value"));
  });

  it("an over-corrected heading (h1 > h2 > h5 now skips levels)", async () => {
    const v = await run(findingAt("heading-order", 15), "<h4>Opening hours</h4>", "<h2>Opening hours</h2>");
    assert.equal(v.status, "rejected_regression", v.reason ?? "");
  });
});

describe("shape validation", () => {
  it("rejects a hallucinated `before`", async () => {
    const v = await run(findingAt("image-alt", 12), '<img src="q3_sales.png">', '<img src="q3_sales.png" alt="x">');
    assert.equal(v.status, "rejected_invalid");
  });

  it("rejects `before` copied with line-number prefixes", async () => {
    const v = await run(findingAt("image-alt", 12), `12 |       ${IMG}`, '<img src="q3-sales.png" alt="Sales chart">');
    assert.equal(v.status, "rejected_invalid");
  });

  it("rejects an ambiguous `before` that does not overlap the target", async () => {
    // "\n    <input" occurs twice (lines 18 and 19); neither overlaps the image on line 12.
    const v = await run(findingAt("image-alt", 12), "\n    <input", "\n    <input data-x");
    assert.equal(v.status, "rejected_apply_failed", v.reason ?? "");
  });

  it("rejects diffs that touch too many lines", async () => {
    const start = src.indexOf("<h1>");
    const end = src.indexOf("<p>");
    const big = src.slice(start, end);
    const changed = big
      .split("\n")
      .map((l) => (l.trim() ? `${l} ` : l))
      .join("\n");
    const v = await run(findingAt("image-alt", 12), big, changed);
    assert.equal(v.status, "rejected_invalid");
    assert.match(v.reason ?? "", /lines|hunks/);
  });

  it("rejects an empty `after`", async () => {
    const v = await run(findingAt("image-alt", 12), IMG, "   ");
    assert.equal(v.status, "rejected_invalid");
  });

  it("rejects a patch for another finding", async () => {
    const f = findingAt("image-alt", 12);
    const patch = { findingId: "f_9999", rationale: "x", before: IMG, after: '<img src="q3-sales.png" alt="Sales">', confidence: "high" };
    const v = (await verifyPatch({ file: FILE, src, finding: f, patch, baseline })).verification;
    assert.equal(v.status, "rejected_invalid");
  });

  it("rejects output that does not match the schema", async () => {
    const f = findingAt("image-alt", 12);
    const v = (await verifyPatch({ file: FILE, src, finding: f, patch: { findingId: f.id, after: "x" }, baseline })).verification;
    assert.equal(v.status, "rejected_invalid");
  });
});

describe("identifiers as labels and id references (ADR 0015)", () => {
  const IFILE = fixture("identifiers.html");
  let isrc = "";
  let ibase: AuditResult;
  const at = (rule: string, line: number): Finding => {
    const f = ibase.findings.find((x) => x.ruleId === rule && x.sourceLines?.start === line);
    assert.ok(f, `no ${rule} finding on line ${line}: ${ibase.findings.map((x) => `${x.ruleId}@${x.sourceLines?.start}`).join(", ")}`);
    return f;
  };
  const check = async (f: Finding, b: string, a: string) =>
    (await verifyPatch({ file: IFILE, src: isrc, finding: f, baseline: ibase, patch: { findingId: f.id, rationale: "t", before: b, after: a, confidence: "high" } })).verification;
  const EMAIL = '<input type="email" name="email">';
  const FIRST = '<input type="text" name="first_name">';
  const COMBO = '<div role="combobox" tabindex="0" aria-label="Region">';

  before(async () => {
    isrc = await readFile(IFILE, "utf8");
    ibase = await auditSource(IFILE, isrc, { rules: RULES });
  });

  it('accepts aria-label="Email" on name="email" when "Email" is the visible text next to it', async () => {
    const v = await check(at("label", 14), EMAIL, '<input type="email" name="email" aria-label="Email">');
    assert.equal(v.status, "verified", v.reason ?? "");
  });

  it("rejects an aria-label that only restates the name attribute", async () => {
    const v = await check(at("label", 18), FIRST, '<input type="text" name="first_name" aria-label="first name">');
    assert.equal(v.status, "rejected_suspicious", v.reason ?? "");
    assert.match(v.reason ?? "", /restates the name attribute/);
  });

  it("accepts an aria-label that says more than the name attribute", async () => {
    const v = await check(at("label", 18), FIRST, '<input type="text" name="first_name" aria-label="First name as on your ticket">');
    assert.equal(v.status, "verified", v.reason ?? "");
  });

  it("rejects an id reference to an element that does not exist", async () => {
    const v = await check(at("label", 18), FIRST, '<input type="text" name="first_name" aria-label="Given name" aria-describedby="hint">');
    assert.equal(v.status, "rejected_suspicious", v.reason ?? "");
    assert.match(v.reason ?? "", /aria-describedby -> "hint"/);
  });

  it("accepts an id reference to an element that exists", async () => {
    const v = await check(at("label", 18), FIRST, '<input type="text" name="first_name" aria-label="Given name" aria-describedby="name-hint">');
    assert.equal(v.status, "verified", v.reason ?? "");
  });

  it('rejects a required aria-controls set to "false"', async () => {
    const v = await check(at("aria-required-attr", 21), COMBO, '<div role="combobox" tabindex="0" aria-label="Region" aria-expanded="false" aria-controls="false">');
    assert.equal(v.status, "rejected_suspicious", v.reason ?? "");
    assert.match(v.reason ?? "", /aria-controls -> "false"/);
  });

  it("accepts a required aria-controls that points at the listbox", async () => {
    const v = await check(at("aria-required-attr", 21), COMBO, '<div role="combobox" tabindex="0" aria-label="Region" aria-expanded="false" aria-controls="regions">');
    assert.equal(v.status, "verified", v.reason ?? "");
  });
});
