// Markdown report for a site crawl.

import type { RuleRegistry } from "../rule.js";
import { siteStats, type SiteFinding, type SiteResult } from "./crawl.js";

export interface SiteGroup {
  fingerprint: string;
  ruleId: string;
  html: string;
  pages: string[];
  nodes: number;
}

/** Findings with the same rule and markup on two or more pages: probably one template to fix once. */
export function sharedGroups(r: SiteResult): SiteGroup[] {
  const groups = new Map<string, SiteGroup>();
  for (const p of r.pages) {
    for (const f of p.findings) {
      const g = groups.get(f.fingerprint) ?? { fingerprint: f.fingerprint, ruleId: f.ruleId, html: f.outerHTML, pages: [], nodes: 0 };
      if (!g.pages.includes(p.url)) g.pages.push(p.url);
      g.nodes++;
      groups.set(f.fingerprint, g);
    }
  }
  return Array.from(groups.values())
    .filter((g) => g.pages.length > 1)
    .sort((a, b) => b.pages.length - a.pages.length || a.ruleId.localeCompare(b.ruleId));
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const code = (s: string, max = 90) => `\`${cell(s.length > max ? `${s.slice(0, max)}…` : s).replace(/`/g, "'")}\``;

export function renderSiteReport(r: SiteResult, registry: RuleRegistry, date = new Date().toISOString().slice(0, 10)): string {
  const st = siteStats(r);
  const all: Array<{ page: string; f: SiteFinding }> = r.pages.flatMap((p) => p.findings.map((f) => ({ page: p.url, f })));
  const L: string[] = [];
  L.push(`# verifa11y site audit: ${r.origin}`);
  L.push("");
  L.push(
    `${date}. Start: ${r.start}. Viewports: ${r.viewports.join(", ")}. Engines: ${Object.entries(r.engine)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}.`,
  );
  L.push("");
  L.push(
    "> This is an automated audit of the pages as rendered at crawl time, with axe-core. It finds a subset of WCAG " +
      "failures and cannot judge most of WCAG. verifa11y does not guarantee WCAG conformance. Site mode does not patch: " +
      "the live site has no source file to edit. Fix the source files with `verifa11y fix`.",
  );
  L.push("");
  L.push("## Summary");
  L.push("");
  L.push("| | |");
  L.push("|---|---:|");
  L.push(`| Pages visited | ${st.pages} |`);
  L.push(`| Audited | ${st.audited} |`);
  L.push(`| Reused from the previous run (HTML unchanged) | ${st.reused} |`);
  L.push(`| Duplicates (same rendered DOM as another page) | ${st.duplicate} |`);
  L.push(`| Skipped (robots.txt, not HTML, HTTP error, off-site redirect) | ${st.skipped} |`);
  L.push(`| Errors | ${st.error} |`);
  L.push(`| Findings in the patched rule subset | ${st.findings} |`);
  L.push(`| WCAG A/AA violations, any axe rule (rule + node, all viewports) | ${r.pages.reduce((n, p) => n + p.wcagViolations, 0)} |`);
  L.push(`| Requests blocked by the sandbox (other origins) | ${r.pages.reduce((n, p) => n + p.blockedRequests, 0)} |`);
  L.push("");
  L.push(
    `robots.txt: ${r.robots.found ? "found" : "not found"}${r.robots.respected ? "" : " (ignored: --ignore-robots)"}` +
      `${r.robots.crawlDelay !== null ? `, Crawl-delay ${r.robots.crawlDelay} s` : ""}. Sitemap pages: ${r.sitemapPages}.`,
  );
  L.push("");

  L.push("## Findings by rule");
  L.push("");
  const byRule = new Map<string, { n: number; pages: Set<string> }>();
  for (const { page, f } of all) {
    const e = byRule.get(f.ruleId) ?? { n: 0, pages: new Set<string>() };
    e.n++;
    e.pages.add(page);
    byRule.set(f.ruleId, e);
  }
  if (byRule.size === 0) L.push("No findings in the rule subset.");
  else {
    L.push("| Rule | Tier | Findings | Pages |");
    L.push("|---|---:|---:|---:|");
    for (const [rule, e] of [...byRule].sort((a, b) => b[1].n - a[1].n)) {
      const tier = registry.forFinding({ ruleId: rule } as SiteFinding)?.tier ?? "?";
      L.push(`| ${rule} | ${tier} | ${e.n} | ${e.pages.size} |`);
    }
  }
  L.push("");

  const groups = sharedGroups(r);
  L.push("## Repeated across pages");
  L.push("");
  if (groups.length === 0) L.push("No finding repeats with identical markup on more than one page.");
  else {
    L.push("Same rule and same markup on several pages: most likely one template or component. Fix it once at the source.");
    L.push("");
    L.push("| Rule | Pages | Markup | Example |");
    L.push("|---|---:|---|---|");
    for (const g of groups.slice(0, 50)) L.push(`| ${g.ruleId} | ${g.pages.length} | ${code(g.html)} | ${g.pages[0]} |`);
    if (groups.length > 50) L.push(`| … | | ${groups.length - 50} more in site.json | |`);
  }
  L.push("");

  L.push("## Pages");
  L.push("");
  L.push("| Page | Status | Findings | WCAG A/AA | Viewports | Notes |");
  L.push("|---|---|---:|---:|---|---|");
  for (const p of r.pages) {
    const notes = [p.reason, p.duplicateOf ? `duplicate of ${p.duplicateOf}` : "", ...p.notes].filter(Boolean).join("; ");
    const counts = p.status === "audited" || p.status === "reused";
    L.push(`| ${p.url} | ${p.status} | ${counts ? p.findings.length : ""} | ${counts ? p.wcagViolations : ""} | ${p.viewports.join(", ")} | ${cell(notes)} |`);
  }
  L.push("");

  const listed = all.slice(0, 300);
  if (listed.length) {
    L.push("## Findings");
    L.push("");
    L.push("| Page | Rule | Element | Viewports | Capture |");
    L.push("|---|---|---|---|---|");
    for (const { page, f } of listed) {
      L.push(`| ${page} | ${f.ruleId} | ${code(f.outerHTML, 70)} | ${f.viewports.join(", ")} | ${f.screenshot ? `[png](screenshots/${f.screenshot})` : ""} |`);
    }
    if (all.length > listed.length) L.push(`| … | ${all.length - listed.length} more in site.json | | | |`);
    L.push("");
  }

  L.push("## Limits of this audit");
  L.push("");
  L.push("- Pages run their own scripts here, so what was audited is the DOM after network idle, not the HTML source.");
  L.push("- Requests to origins other than the target (and any `--allow-origin`) were blocked: third-party fonts, styles or widgets were not loaded, which can change contrast and layout results.");
  L.push("- Pages are deduplicated by a hash of the rendered DOM: pages that differ only in a timestamp or token are audited separately.");
  L.push("- Reused pages were not re-rendered: their HTML was byte-identical to the previous run. Changes that arrive only through scripts or APIs are missed by an incremental run; run without `--incremental` to re-audit everything.");
  L.push("");
  return `${L.join("\n")}\n`;
}
