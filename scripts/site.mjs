#!/usr/bin/env node
// Builds and checks the project website (site/ -> .site-build/).
//
//   node scripts/site.mjs build   copy site/ and the demo recording into .site-build/
//   node scripts/site.mjs serve   build, then serve .site-build/ on http://localhost:4173 (PORT to change)
//   node scripts/site.mjs check   build, then fail if
//                                 - verifa11y/axe-core report any WCAG 2.x A/AA violation on the page (desktop and
//                                   375px wide), the page scrolls sideways on a phone, or
//                                 - any number marked data-metric differs from the benchmark reports.
//
// The page claims it is checked before every deploy; this is that check.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".site-build");
const require = createRequire(import.meta.url);

async function build() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(path.join(ROOT, "site"), OUT, { recursive: true });
  await cp(path.join(ROOT, "docs/demo.svg"), path.join(OUT, "demo.svg"));
  // Self-hosted fonts (OFL-1.1): no request ever leaves for a font CDN.
  await mkdir(path.join(OUT, "fonts"), { recursive: true });
  for (const [pkg, file] of [
    ["@fontsource-variable/geist", "geist-latin-wght-normal.woff2"],
    ["@fontsource-variable/geist-mono", "geist-mono-latin-wght-normal.woff2"],
  ]) {
    const dir = path.dirname(require.resolve(`${pkg}/package.json`));
    await cp(path.join(dir, "files", file), path.join(OUT, "fonts", file));
    await cp(path.join(dir, "LICENSE"), path.join(OUT, "fonts", `${file.split("-latin")[0]}-OFL.txt`));
  }
  // Tool logos from Simple Icons (CC0), inlined as <symbol>s: no request to a CDN. The brands themselves stay
  // their owners' trademarks; they are shown to say where verifa11y runs (MCP hosts, CLIs, CI).
  const index = path.join(OUT, "index.html");
  const html = await readFile(index, "utf8");
  await writeFile(index, html.replace("<!-- brand-icons -->", await brandSymbols()), "utf8");
  console.log(`built ${path.relative(ROOT, OUT)}/`);
}

const BRANDS = ["claudecode", "claude", "cursor", "windsurf", "zedindustries", "cline", "githubcopilot", "googlegemini", "jetbrains", "opencode", "warp", "amp", "ollama", "githubactions", "github"];

async function brandSymbols() {
  const dir = path.dirname(require.resolve("simple-icons/icons/github.svg"));
  const out = [];
  for (const slug of BRANDS) {
    const svg = await readFile(path.join(dir, `${slug}.svg`), "utf8");
    const d = /<path d="([^"]+)"/.exec(svg)?.[1];
    if (!d) throw new Error(`no path in simple-icons/${slug}.svg`);
    out.push(`<symbol id="lg-${slug}" viewBox="0 0 24 24"><path fill="currentColor" d="${d}"/></symbol>`);
  }
  return out.join("");
}

/* Numbers -------------------------------------------------------------- */

function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [k === 0 ? 0 : Math.max(0, mid - half), k === n ? 1 : Math.min(1, mid + half)];
}
const trim = (x) => (100 * x).toFixed(1).replace(/\.0$/, "");
const precision = (k, n) => `${((100 * k) / n).toFixed(1)}%`;
const ci = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return `[${trim(lo)}–${trim(hi)}]`;
};

async function expectedMetrics() {
  const read = async (f) => JSON.parse(await readFile(path.join(ROOT, f), "utf8"));
  const codemod = await read("bench/codemod/metrics.json");
  const naive = await read("bench/baselines/naive/metrics.json");
  const m = {};
  const sets = ["dev", "eval"];
  for (const s of sets) if (!codemod.bySet?.[s] || !naive.bySet?.[s]) throw new Error(`metrics.json has no "${s}" set`);
  m["pages.all"] = codemod.pages;
  for (const s of sets) m[`pages.${s}`] = codemod.bySet[s].pages;
  for (const s of sets) {
    const c = codemod.bySet[s].byTier["0"];
    m[`codemod.${s}.verified`] = c.verified;
    m[`codemod.${s}.proposed`] = c.proposed;
    m[`codemod.${s}.precision`] = precision(c.verified, c.proposed);
    m[`codemod.${s}.ci`] = ci(c.verified, c.proposed);
    const n = naive.bySet[s].overall;
    m[`naive.${s}.verified`] = n.verified;
    m[`naive.${s}.proposed`] = n.proposed;
    m[`naive.${s}.precision`] = precision(n.verified, n.proposed);
    m[`naive.${s}.ci`] = ci(n.verified, n.proposed);
    m[`naive.${s}.applied`] = n.applied;
    m[`naive.${s}.rejected`] = n.applied - n.verified;
    m[`naive.${s}.axeAccepted`] = n.axeAccepted;
    m[`naive.${s}.axeRejected`] = n.axeAccepted - n.verified;
    m[`naive.${s}.sourceAccepted`] = n.sourceAccepted;
    m[`naive.${s}.sourceRejected`] = n.sourceAccepted - n.verified;
  }
  m["codemod.all.verified"] = sets.reduce((t, s) => t + codemod.bySet[s].byTier["0"].verified, 0);
  m["codemod.all.proposed"] = sets.reduce((t, s) => t + codemod.bySet[s].byTier["0"].proposed, 0);
  m["naive.all.axeOnlyRejected"] = sets.reduce((t, s) => t + naive.bySet[s].overall.axeAccepted - naive.bySet[s].overall.verified, 0);
  return m;
}

async function checkMetrics(html) {
  const expected = await expectedMetrics();
  const errors = [];
  let count = 0;
  for (const match of html.matchAll(/<[^>]*\bdata-metric="([^"]+)"[^>]*>([^<]*)</g)) {
    count++;
    const [, key, shown] = match;
    if (!(key in expected)) errors.push(`unknown metric "${key}"`);
    else if (String(expected[key]) !== shown.trim()) errors.push(`${key}: page says "${shown.trim()}", reports say "${expected[key]}"`);
  }
  if (count === 0) errors.push("no data-metric numbers found");
  // Bar lengths (style="--v:N") must match the same reports.
  for (const match of html.matchAll(/<[^>]*\bdata-bar="([^"]+)"[^>]*style="--v:(\d+)"[^>]*>/g)) {
    count++;
    const [, key, v] = match;
    if (!(key in expected)) errors.push(`unknown bar metric "${key}"`);
    else if (String(expected[key]) !== v) errors.push(`bar ${key}: page draws ${v}, reports say ${expected[key]}`);
  }
  return { count, errors };
}

/* Accessibility --------------------------------------------------------- */

async function checkAccessibility(file) {
  const { auditFile, closeBrowser } = await import("verifa11y-core");
  const { createCoreRegistry } = await import("verifa11y-rules-core");
  try {
    const r = await auditFile(file, { rules: createCoreRegistry().axeIds() });
    return r.all.map((v) => `${v.ruleId} at ${v.selector}${v.sourceLines ? ` (line ${v.sourceLines.start})` : ""}`);
  } finally {
    await closeBrowser();
  }
}

// The phone layout swaps some parts (the comparison becomes cards, header labels collapse), so axe runs there too,
// after the page's own scripts. Playwright and axe-core come from verifa11y-core's dependencies.
async function checkPhone(file) {
  const coreRequire = createRequire(path.join(ROOT, "packages/core/package.json"));
  const { chromium } = coreRequire("playwright");
  const browser = await chromium.launch();
  try {
    // Reduced motion: the settled page, not a frame halfway through an animation.
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await page.goto(pathToFileURL(file).href);
    await page.waitForLoadState("load");
    await page.addScriptTag({ path: coreRequire.resolve("axe-core/axe.min.js") });
    const found = await page.evaluate(async () => {
      const r = await globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v) => `${v.id} at ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) found.push(`the page scrolls sideways by ${overflow}px at 375px wide`);
    return found;
  } finally {
    await browser.close();
  }
}

const cmd = process.argv[2];
if (cmd === "build") {
  await build();
} else if (cmd === "check") {
  await build();
  const page = path.join(OUT, "index.html");
  const html = await readFile(page, "utf8");
  const metrics = await checkMetrics(html);
  const violations = await checkAccessibility(page);
  const phone = await checkPhone(page);
  for (const e of metrics.errors) console.error(`numbers: ${e}`);
  for (const v of violations) console.error(`accessibility: ${v}`);
  for (const v of phone) console.error(`accessibility (phone): ${v}`);
  if (metrics.errors.length || violations.length || phone.length) process.exit(1);
  console.log(`site check passed: ${metrics.count} numbers match the reports; no WCAG 2.x A/AA violation reported by axe-core, on desktop or at phone width.`);
} else if (cmd === "serve") {
  await build();
  const { createServer } = await import("node:http");
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
  const port = Number(process.env.PORT ?? 4173);
  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "") || "index.html";
    const file = path.join(OUT, rel);
    if (!file.startsWith(OUT)) return void res.writeHead(403).end();
    try {
      const body = await readFile(file.endsWith(path.sep) ? path.join(file, "index.html") : file);
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  }).listen(port, "127.0.0.1", () => console.log(`serving ${path.relative(ROOT, OUT)}/ on http://localhost:${port}`));
} else {
  console.error("usage: node scripts/site.mjs build|serve|check");
  process.exit(2);
}
