// Site mode: crawl a live site and audit every page it reaches.
//
// Unlike file mode, pages here run their own scripts (real rendering: wait
// for network idle, several viewports). There is no source file to patch, so
// site mode audits and reports; fixing stays a file-mode job.
//
// Safety and politeness:
//   - only the start URL's origin is crawled; the browser may load resources
//     from that origin and from explicitly allowed ones, everything else is
//     aborted (rendering third-party HTML is attack surface, and an audit
//     should not phone home on the site's behalf);
//   - authentication (headers, cookies, basic auth) is sent to the target
//     origin only, never to allowed third-party origins;
//   - robots.txt is honoured unless told otherwise, with its Crawl-delay;
//   - a minimum delay between requests to the origin and a concurrency cap;
//   - every page gets its own browser context (no shared cookies, storage
//     or cache between pages beyond the configured auth).

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import { normalize, runAxe } from "../audit.js";
import { getBrowser } from "../browser.js";
import type { Finding } from "../types.js";
import { engineVersions } from "../versions.js";
import { ALLOW_ALL, parseRobots, type Robots } from "./robots.js";
import { parseSitemap } from "./sitemap.js";
import type { Store } from "./store.js";

export interface Viewport {
  name: string;
  width: number;
  height: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export const VIEWPORTS: Record<string, Viewport> = {
  desktop: { name: "desktop", width: 1280, height: 900 },
  tablet: { name: "tablet", width: 768, height: 1024, hasTouch: true },
  mobile: { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
};

export interface SiteAuth {
  /** Extra request headers, sent to the target origin only. */
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string }>;
  basic?: { username: string; password: string };
}

export interface CrawlOptions {
  start: string;
  /** Link depth from the start page (0 = only the start page). */
  maxDepth?: number;
  maxPages?: number;
  /** axe rule ids reported as findings. */
  rules: string[];
  filter?: (f: Finding) => boolean;
  viewports?: Viewport[];
  auth?: SiteAuth;
  /** Origins the browser may load resources from besides the target (CDNs). Never crawled. */
  allowOrigins?: string[];
  respectRobots?: boolean;
  useSitemap?: boolean;
  concurrency?: number;
  /** Minimum ms between requests to the origin. Default: robots Crawl-delay, else 0. */
  delayMs?: number;
  timeoutMs?: number;
  include?: RegExp;
  exclude?: RegExp;
  /** Directory for per-finding element captures; null disables them. */
  screenshotsDir?: string | null;
  maxScreenshotsPerPage?: number;
  store?: Store;
  /** Reuse stored results for pages whose HTML did not change (needs `store`). */
  incremental?: boolean;
  log?: (msg: string) => void;
}

export interface SiteFinding extends Finding {
  /** Viewports the violation was reported in. */
  viewports: string[];
  /** Element capture (path relative to the screenshots dir), if taken. */
  screenshot: string | null;
  /** Same rule and same markup: the same template issue on several pages. */
  fingerprint: string;
}

export type PageStatus = "audited" | "reused" | "duplicate" | "skipped" | "error";

export interface SitePage {
  url: string;
  finalUrl: string | null;
  depth: number;
  status: PageStatus;
  reason?: string;
  duplicateOf?: string;
  httpStatus: number | null;
  /** sha256 of the HTML as served (incremental runs compare this). */
  rawHash: string | null;
  /** sha256 of the rendered DOM (duplicate detection). */
  domHash: string | null;
  links: string[];
  findings: SiteFinding[];
  /** WCAG A/AA violations of any rule (unique rule + node across viewports). */
  wcagViolations: number;
  viewports: string[];
  /** Requests the sandbox aborted (other origins). */
  blockedRequests: number;
  notes: string[];
  ms: number;
}

export interface SiteResult {
  start: string;
  origin: string;
  pages: SitePage[];
  robots: { found: boolean; respected: boolean; crawlDelay: number | null; sitemaps: string[] };
  sitemapPages: number;
  viewports: string[];
  engine: Record<string, string>;
  engineKey: string;
  axeVersion: string | null;
  runId: number | null;
  ms: number;
}

const SKIP_EXT = /\.(pdf|zip|gz|tgz|rar|7z|png|jpe?g|gif|svg|webp|avif|ico|bmp|mp4|webm|mov|mp3|wav|ogg|docx?|xlsx?|pptx?|odt|csv|css|js|mjs|json|xml|txt|woff2?|ttf|eot|exe|dmg|apk)$/i;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Canonical form used for "seen" checks: no fragment, default ports dropped by URL. */
export function canonicalUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  return u.href;
}

export function fingerprintOf(ruleId: string, html: string): string {
  return createHash("sha1").update(`${ruleId}\n${html.replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 12);
}

/** Spaces out requests to one origin: each call waits for its slot. */
function gate(delayMs: number) {
  let next = 0;
  return async () => {
    if (delayMs <= 0) return;
    const now = Date.now();
    const slot = Math.max(now, next);
    next = slot + delayMs;
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  };
}

export async function crawlSite(opts: CrawlOptions): Promise<SiteResult> {
  const started = Date.now();
  const log = opts.log ?? (() => {});
  const startUrl = canonicalUrl(opts.start);
  if (!startUrl) throw new Error(`not an http(s) URL: ${opts.start}`);
  const origin = new URL(startUrl).origin;
  const maxDepth = opts.maxDepth ?? 2;
  const maxPages = opts.maxPages ?? 50;
  const viewports = opts.viewports?.length ? opts.viewports : [VIEWPORTS.desktop!];
  const allowOrigins = new Set([origin, ...(opts.allowOrigins ?? []).map((o) => new URL(o).origin)]);
  const respectRobots = opts.respectRobots ?? true;
  const engine = engineVersions();
  const engineKey = sha256(JSON.stringify({ engine, rules: [...opts.rules].sort(), viewports: viewports.map((v) => v.name) })).slice(0, 16);
  const authHeaders = authHeadersFor(opts.auth);
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const fetchText = async (url: string): Promise<{ status: number; type: string; body: string } | null> => {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "verifa11y", ...(new URL(url).origin === origin ? authHeaders : {}) },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
    } catch {
      return null;
    }
  };

  // robots.txt and sitemaps.
  let robots: Robots = ALLOW_ALL;
  let robotsFound = false;
  const r = await fetchText(`${origin}/robots.txt`);
  if (r && r.status === 200) {
    robots = parseRobots(r.body);
    robotsFound = true;
  }
  const allowed = (url: string) => !respectRobots || robots.allowed(url);
  const delayMs = opts.delayMs ?? (respectRobots && robots.crawlDelay !== null ? robots.crawlDelay * 1000 : 0);
  const wait = gate(delayMs);

  const sitemapPages: string[] = [];
  if (opts.useSitemap ?? true) {
    const queue = robots.sitemaps.length ? [...robots.sitemaps] : [`${origin}/sitemap.xml`];
    const seenMaps = new Set<string>();
    while (queue.length && seenMaps.size < 20) {
      const sm = queue.shift()!;
      if (seenMaps.has(sm) || new URL(sm, origin).origin !== origin) continue;
      seenMaps.add(sm);
      await wait();
      const res = await fetchText(sm);
      if (!res || res.status !== 200) continue;
      const doc = parseSitemap(res.body);
      queue.push(...doc.sitemaps);
      sitemapPages.push(...doc.pages);
    }
  }

  const store = opts.store;
  const siteId = store ? store.siteId(origin) : null;
  const runId = store
    ? store.beginRun("site", siteId, engine, {
        start: startUrl,
        maxDepth,
        maxPages,
        viewports: viewports.map((v) => v.name),
        respectRobots,
        incremental: Boolean(opts.incremental),
      })
    : null;

  const inScope = (url: string) => {
    if (new URL(url).origin !== origin) return false;
    if (SKIP_EXT.test(new URL(url).pathname)) return false;
    if (opts.include && !opts.include.test(url)) return false;
    if (opts.exclude?.test(url)) return false;
    return true;
  };

  const pages: SitePage[] = [];
  const seen = new Set<string>();
  const domHashes = new Map<string, string>();
  const queue: Array<{ url: string; depth: number }> = [];
  let started_ = 0;
  let axeVersion: string | null = null;

  const enqueue = (raw: string, depth: number, base?: string) => {
    const url = canonicalUrl(raw, base);
    if (!url || seen.has(url) || depth > maxDepth || !inScope(url)) return;
    seen.add(url);
    // Disallowed pages are recorded but never requested, and do not count
    // against --max-pages.
    if (!allowed(url)) {
      const page = blank(url, depth, "skipped", "disallowed by robots.txt");
      pages.push(page);
      if (store) store.savePage(runId!, siteId!, page, engineKey);
      return;
    }
    queue.push({ url, depth });
  };
  const blank = (url: string, depth: number, status: PageStatus, reason: string): SitePage => ({
    url,
    finalUrl: null,
    depth,
    status,
    reason,
    httpStatus: null,
    rawHash: null,
    domHash: null,
    links: [],
    findings: [],
    wcagViolations: 0,
    viewports: [],
    blockedRequests: 0,
    notes: [],
    ms: 0,
  });

  enqueue(startUrl, 0);
  for (const p of sitemapPages) enqueue(p, Math.min(1, maxDepth));

  const visit = async (url: string, depth: number): Promise<SitePage> => {
    const t0 = Date.now();

    // Incremental: if the served HTML is byte-identical to the stored one and
    // the engines, rules and viewports are the same, reuse the stored audit.
    if (store && opts.incremental) {
      const prev = store.previousPage(siteId!, url);
      if (prev && prev.status === "audited" && prev.engineKey === engineKey && prev.rawHash) {
        await wait();
        const res = await fetchText(url);
        if (res && sha256(res.body) === prev.rawHash) {
          // Keep duplicate detection working for pages that are re-rendered.
          if (prev.domHash && !domHashes.has(prev.domHash)) domHashes.set(prev.domHash, url);
          return {
            ...blank(url, depth, "reused", "HTML unchanged since the last run"),
            reason: undefined,
            finalUrl: prev.finalUrl,
            httpStatus: prev.httpStatus,
            rawHash: prev.rawHash,
            domHash: prev.domHash,
            links: prev.links,
            findings: prev.findings,
            wcagViolations: prev.wcagViolations,
            viewports: prev.viewports,
            ms: Date.now() - t0,
          };
        }
      }
    }

    const merged = new Map<string, SiteFinding>();
    const wcagKeys = new Set<string>();
    const out: SitePage = blank(url, depth, "audited", "");
    out.reason = undefined;

    for (const [vi, vp] of viewports.entries()) {
      await wait();
      const first = vi === 0;
      const r = await renderAndAudit(url, vp, {
        origin,
        allowOrigins,
        auth: opts.auth ?? {},
        authHeaders,
        timeoutMs,
        rules: opts.rules,
        filter: opts.filter,
        collectLinks: first,
        screenshotsDir: first && opts.screenshotsDir ? path.join(opts.screenshotsDir, slug(url)) : null,
        maxScreenshots: opts.maxScreenshotsPerPage ?? 20,
      });
      out.blockedRequests += r.blocked;
      out.notes.push(...r.notes.map((n) => (viewports.length > 1 ? `${vp.name}: ${n}` : n)));
      if (r.error) {
        if (first) return { ...out, status: r.skip ? "skipped" : "error", reason: r.error, httpStatus: r.httpStatus, finalUrl: r.finalUrl, ms: Date.now() - t0 };
        continue;
      }
      if (first) {
        out.finalUrl = r.finalUrl;
        out.httpStatus = r.httpStatus;
        out.rawHash = r.rawHash;
        out.domHash = r.domHash;
        out.links = r.links;
        // Same rendered DOM as a page already audited (/, /index.html, ?utm=...): audit once.
        const dup = r.domHash ? domHashes.get(r.domHash) : undefined;
        if (dup) return { ...out, status: "duplicate", duplicateOf: dup, findings: [], ms: Date.now() - t0 };
        if (r.domHash) domHashes.set(r.domHash, url);
        // A redirect to another origin: not ours to audit.
        if (r.finalUrl && new URL(r.finalUrl).origin !== origin) {
          return { ...out, status: "skipped", reason: `redirected off-site to ${r.finalUrl}`, ms: Date.now() - t0 };
        }
      }
      axeVersion ??= r.axeVersion;
      out.viewports.push(vp.name);
      for (const v of r.all) wcagKeys.add(`${v.ruleId}|${v.selector}`);
      for (const f of r.findings) {
        const key = `${f.ruleId}|${f.selector}`;
        const have = merged.get(key);
        if (have) have.viewports.push(vp.name);
        else merged.set(key, { ...f, viewports: [vp.name], screenshot: r.shots.get(f.id) ?? null, fingerprint: fingerprintOf(f.ruleId, f.outerHTML) });
      }
    }
    out.findings = Array.from(merged.values());
    out.findings.forEach((f, i) => (f.id = `f_${String(i + 1).padStart(4, "0")}`));
    out.wcagViolations = wcagKeys.size;
    out.ms = Date.now() - t0;
    return out;
  };

  // Worker pool over a growing queue.
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  await new Promise<void>((resolve, reject) => {
    let active = 0;
    const pump = () => {
      while (active < concurrency && queue.length && started_ < maxPages) {
        const { url, depth } = queue.shift()!;
        started_++;
        active++;
        visit(url, depth)
          .then((page) => {
            pages.push(page);
            if (store) store.savePage(runId!, siteId!, page, engineKey);
            log(`  [${page.status}] ${url}${page.reason ? ` (${page.reason})` : ""}${page.status === "audited" || page.status === "reused" ? `: ${page.findings.length} finding(s)` : ""}`);
            if (page.status === "audited" || page.status === "reused") {
              for (const l of page.links) enqueue(l, depth + 1, page.finalUrl ?? url);
            }
          })
          .catch(reject)
          .finally(() => {
            active--;
            if (active === 0 && (!queue.length || started_ >= maxPages)) resolve();
            else pump();
          });
      }
      if (active === 0) resolve();
    };
    pump();
  });

  pages.sort((a, b) => a.depth - b.depth || a.url.localeCompare(b.url));
  const result: SiteResult = {
    start: startUrl,
    origin,
    pages,
    robots: { found: robotsFound, respected: respectRobots, crawlDelay: robots.crawlDelay, sitemaps: robots.sitemaps },
    sitemapPages: sitemapPages.length,
    viewports: viewports.map((v) => v.name),
    engine,
    engineKey,
    axeVersion,
    runId,
    ms: Date.now() - started,
  };
  if (store) store.finishRun(runId!, siteStats(result));
  return result;
}

export function siteStats(r: SiteResult) {
  const by = (s: PageStatus) => r.pages.filter((p) => p.status === s).length;
  return {
    pages: r.pages.length,
    audited: by("audited"),
    reused: by("reused"),
    duplicate: by("duplicate"),
    skipped: by("skipped"),
    error: by("error"),
    findings: r.pages.reduce((n, p) => n + p.findings.length, 0),
  };
}

function authHeadersFor(auth: SiteAuth | undefined): Record<string, string> {
  const h: Record<string, string> = { ...(auth?.headers ?? {}) };
  if (auth?.basic) h.authorization = `Basic ${Buffer.from(`${auth.basic.username}:${auth.basic.password}`).toString("base64")}`;
  if (auth?.cookies?.length) h.cookie = auth.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return h;
}

function slug(url: string): string {
  const u = new URL(url);
  const readable = `${u.pathname}${u.search}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "index";
  return `${readable}-${sha256(url).slice(0, 8)}`;
}

/* ---------------------------------------------------------------------- */

interface RenderOptions {
  origin: string;
  allowOrigins: Set<string>;
  auth: SiteAuth;
  authHeaders: Record<string, string>;
  timeoutMs: number;
  rules: string[];
  filter?: (f: Finding) => boolean;
  collectLinks: boolean;
  screenshotsDir: string | null;
  maxScreenshots: number;
}

interface RenderResult {
  error: string | null;
  /** The page is out of scope (not HTML, HTTP error) rather than broken. */
  skip: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  rawHash: string | null;
  domHash: string | null;
  links: string[];
  findings: Finding[];
  all: Array<{ ruleId: string; selector: string }>;
  shots: Map<string, string>;
  axeVersion: string | null;
  blocked: number;
  notes: string[];
}

async function renderAndAudit(url: string, vp: Viewport, o: RenderOptions): Promise<RenderResult> {
  const res: RenderResult = {
    error: null,
    skip: false,
    httpStatus: null,
    finalUrl: null,
    rawHash: null,
    domHash: null,
    links: [],
    findings: [],
    all: [],
    shots: new Map(),
    axeVersion: null,
    blocked: 0,
    notes: [],
  };
  const browser = await getBrowser();
  const context: BrowserContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  try {
    if (o.auth.cookies?.length) {
      await context.addCookies(o.auth.cookies.map((c) => ({ name: c.name, value: c.value, url: o.origin })));
    }
    // The sandbox: target origin (with auth) and explicitly allowed origins
    // (without auth); everything else is aborted.
    await context.route("**/*", async (route) => {
      const req = route.request();
      let reqOrigin: string;
      try {
        reqOrigin = new URL(req.url()).origin;
      } catch {
        return route.abort();
      }
      if (req.url().startsWith("data:") || req.url().startsWith("blob:")) return route.continue();
      if (!o.allowOrigins.has(reqOrigin)) {
        res.blocked++;
        return route.abort("blockedbyclient");
      }
      if (reqOrigin === o.origin && Object.keys(o.authHeaders).length) {
        return route.continue({ headers: { ...req.headers(), ...o.authHeaders } });
      }
      return route.continue();
    });

    const page: Page = await context.newPage();
    let response;
    try {
      response = await page.goto(url, { waitUntil: "networkidle", timeout: o.timeoutMs });
    } catch (err) {
      if (!/Timeout/i.test((err as Error).message)) {
        res.error = `navigation failed: ${(err as Error).message.split("\n")[0]}`;
        return res;
      }
      // Long-polling, analytics beacons, streaming: never idle. Audit what loaded.
      res.notes.push(`network never went idle within ${Math.round(o.timeoutMs / 1000)} s; audited after load`);
      response = null;
      try {
        await page.waitForLoadState("load", { timeout: 5_000 });
      } catch {
        res.error = "page did not finish loading";
        return res;
      }
    }
    res.finalUrl = canonicalUrl(page.url());
    res.httpStatus = response?.status() ?? null;
    const type = response?.headers()["content-type"] ?? "text/html";
    if (res.httpStatus !== null && res.httpStatus >= 400) {
      res.error = `HTTP ${res.httpStatus}`;
      res.skip = true;
      return res;
    }
    if (!/html/i.test(type)) {
      res.error = `not HTML (${type.split(";")[0]})`;
      res.skip = true;
      return res;
    }
    if (response) {
      try {
        res.rawHash = sha256((await response.body()).toString("utf8"));
      } catch {
        res.rawHash = null;
      }
    }

    const dom = await page.evaluate(() => document.documentElement.outerHTML);
    res.domHash = sha256(dom);
    if (o.collectLinks) {
      res.links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href], area[href]"), (a) => (a as HTMLAnchorElement).href),
      );
    }

    const run = await runAxe(page, o.rules);
    res.axeVersion = run.version;
    const n = normalize(run.violations, o.rules, { src: null, sourceFile: url, filter: o.filter });
    res.findings = n.findings;
    res.all = n.all.map((v) => ({ ruleId: v.ruleId, selector: v.selector }));

    if (o.screenshotsDir && res.findings.length) {
      await mkdir(o.screenshotsDir, { recursive: true });
      for (const f of res.findings.slice(0, o.maxScreenshots)) {
        const file = path.join(o.screenshotsDir, `${f.id}-${f.ruleId}.png`);
        try {
          await page.locator(f.selector).first().screenshot({ path: file, timeout: 3_000, animations: "disabled" });
          res.shots.set(f.id, path.join(path.basename(o.screenshotsDir), path.basename(file)).split(path.sep).join("/"));
        } catch {
          // Invisible or detached elements cannot be captured; the finding stays.
        }
      }
    }
    return res;
  } finally {
    await context.close();
  }
}
