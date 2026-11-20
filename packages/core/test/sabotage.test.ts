// The guard against a silently degraded verifier.
//
// For every finding in the hand-written corpus, a saboteur produces patches
// that make axe quiet without fixing anything (hiding, deleting, generic
// text, cosmetic no-ops, hallucinated source). The verifier must reject every
// single one. If this test ever lets one through, every "verified" number the
// project publishes is suspect, so it fails loudly with the list.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  attr,
  auditSource,
  closeBrowser,
  elementStartingAt,
  limiter,
  parseSource,
  setAttr,
  startTagOf,
  verifyPatch,
  DEFAULT_DEEP_CHECKS,
  type DeepCheckOptions,
  type Finding,
  type Patch,
} from "a11yfix-core";
import { createCoreRegistry } from "a11yfix-rules-core";

const CORPUS = fileURLToPath(new URL("../../../corpus/handwritten/", import.meta.url));
const registry = createCoreRegistry();
after(() => closeBrowser());

interface Sabotage {
  name: string;
  patch: Patch;
}

function sabotage(f: Finding, src: string): Sabotage[] {
  if (!f.sourceRange) return [];
  const el = elementStartingAt(parseSource(src), f.sourceRange.start);
  const st = el ? startTagOf(src, el) : null;
  if (!el || !st) return [];
  const tag = st.text;
  const mk = (name: string, before: string, after: string): Sabotage => ({
    name,
    patch: { findingId: f.id, rationale: `sabotage: ${name}`, before, after, confidence: "high" },
  });
  const style = (decl: string) => setAttr(tag, "style", `${decl}; ${attr(el, "style") ?? ""}`.trim());
  const whole = src.slice(f.sourceRange.start, f.sourceRange.end);
  const out = [
    mk("aria-hidden", tag, setAttr(tag, "aria-hidden", "true")),
    mk("role=presentation", tag, setAttr(tag, "role", "presentation")),
    mk("role=none", tag, setAttr(tag, "role", "none")),
    mk("hidden attribute", tag, tag.replace(/\s*(\/?)>$/, " hidden$1>")),
    mk("display:none", tag, style("display: none")),
    mk("clip-path", tag, style("clip-path: inset(50%)")),
    mk("opacity:0", tag, style("opacity: 0")),
    mk("cosmetic no-op", tag, setAttr(tag, "data-a11y", "fixed")),
    mk("hallucinated before", tag.replace(/<(\w)/, "<$1$1"), tag),
  ];
  if (!/\n/.test(whole) && whole.length < 400) out.push(mk("delete element", whole, "<!-- removed -->"));
  if (f.ruleId === "image-alt") {
    const file = (attr(el, "src") ?? "x.png").split("/").pop()!;
    out.push(mk("generic alt", tag, setAttr(tag, "alt", "image")));
    out.push(mk("file-name alt", tag, setAttr(tag, "alt", file.replace(/\.\w+$/, "").replace(/[-_]/g, " "))));
  }
  if (f.ruleId === "label") out.push(mk("one-letter label", tag, setAttr(tag, "aria-label", "x")));
  out.push(mk("inert", tag, setAttr(tag, "inert", "")));
  return out;
}

/** Sabotages only the accessibility-tree, focus and visual checks are expected to catch. */
function deepSabotage(f: Finding, src: string): Array<{ name: string; patch: Patch }> {
  const el = f.sourceRange ? elementStartingAt(parseSource(src), f.sourceRange.start) : null;
  const st = el ? startTagOf(src, el) : null;
  if (!el || !st) return [];
  const tag = st.text;
  const mk = (name: string, before: string, after: string) => ({
    name,
    patch: { findingId: f.id, rationale: "sabotage", before, after, confidence: "high" as const },
  });
  const out = [mk("out of the tab order", tag, setAttr(tag, "tabindex", "-1"))];
  // Recolor everything instead of fixing one element's contrast.
  const style = /<style>/.exec(src);
  if (f.ruleId === "color-contrast" && style) {
    out.push(mk("repaint the page", "<style>", "<style>* { color: #000 !important; background: #fff !important; }"));
  }
  return out;
}

async function sabotageRun(checks: DeepCheckOptions | undefined, extra: boolean) {
  const files = (await readdir(CORPUS)).filter((f) => f.endsWith(".html")).map((f) => path.join(CORPUS, f));
  const limit = limiter(4);
  const leaks: string[] = [];
  let total = 0;
  for (const file of files) {
    const src = await readFile(file, "utf8");
    const baseline = await auditSource(file, src, { rules: registry.axeIds(), probe: checks ? { ax: checks.ax, focus: checks.focus, visual: checks.visual } : undefined });
    const jobs = baseline.findings.flatMap((f) => [...sabotage(f, src), ...(extra ? deepSabotage(f, src) : [])].map((s) => ({ f, s })));
    total += jobs.length;
    await Promise.all(
      jobs.map(({ f, s }) =>
        limit(async () => {
          const { verification } = await verifyPatch({ file, src, finding: f, patch: s.patch, baseline, rule: registry.forFinding(f), checks });
          if (verification.status === "verified") leaks.push(`${path.basename(file)} ${f.id} ${f.ruleId}: "${s.name}" was verified`);
        }),
      ),
    );
  }
  return { total, leaks };
}

it("the verifier rejects every sabotaged patch on the hand-written corpus (axe + static checks)", { timeout: 600_000 }, async () => {
  const { total, leaks } = await sabotageRun(undefined, false);
  assert.ok(total > 300, `expected a few hundred sabotaged patches, got ${total}`);
  assert.deepEqual(leaks, [], `${leaks.length} of ${total} sabotaged patches passed the verifier`);
});

it("the full verifier also rejects sabotage that only the accessibility tree, focus order or pixels reveal", { timeout: 900_000 }, async () => {
  const { total, leaks } = await sabotageRun(DEFAULT_DEEP_CHECKS, true);
  assert.ok(total > 350, `expected a few hundred sabotaged patches, got ${total}`);
  assert.deepEqual(leaks, [], `${leaks.length} of ${total} sabotaged patches passed the verifier`);
});
