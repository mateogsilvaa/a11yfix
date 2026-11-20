// Site mode against a local test site: crawl scope, robots.txt, sitemap,
// duplicates, real rendering, viewports, the network sandbox, auth, captures,
// storage and incremental runs.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  Store,
  VIEWPORTS,
  closeBrowser,
  crawlSite,
  parseRobots,
  parseSitemap,
  renderSiteReport,
  sharedGroups,
  type SiteResult,
} from "a11yfix-core";
import { createCoreRegistry } from "a11yfix-rules-core";

const registry = createCoreRegistry();
const root = fileURLToPath(new URL("./fixtures/site/", import.meta.url));

/* ------------------------------------------------------------------ */

describe("robots.txt", () => {
  const r = parseRobots(
    [
      "User-agent: googlebot",
      "Disallow: /",
      "",
      "User-agent: *",
      "Disallow: /private/",
      "Disallow: /*.json$",
      "Allow: /private/ok.html",
      "Crawl-delay: 2",
      "Sitemap: https://x.test/sitemap.xml",
    ].join("\n"),
  );
  it("uses the * group when no group names a11yfix", () => assert.equal(r.allowed("https://x.test/"), true));
  it("disallows by prefix", () => assert.equal(r.allowed("https://x.test/private/a.html"), false));
  it("lets the longest match win", () => assert.equal(r.allowed("https://x.test/private/ok.html"), true));
  it("supports * and $", () => {
    assert.equal(r.allowed("https://x.test/data/a.json"), false);
    assert.equal(r.allowed("https://x.test/data/a.json?x=1"), true);
  });
  it("reads Crawl-delay and Sitemap", () => {
    assert.equal(r.crawlDelay, 2);
    assert.deepEqual(r.sitemaps, ["https://x.test/sitemap.xml"]);
  });
  it("prefers a group that names a11yfix", () => {
    const s = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: a11yfix\nDisallow: /admin\n");
    assert.equal(s.allowed("https://x.test/page"), true);
    assert.equal(s.allowed("https://x.test/admin/x"), false);
  });
});

describe("sitemap.xml", () => {
  it("reads urlsets and sitemap indexes", () => {
    const doc = parseSitemap(
      `<?xml version="1.0"?><urlset><url><loc>https://x.test/a?x=1&amp;y=2</loc></url><url><loc><![CDATA[https://x.test/b]]></loc></url></urlset>`,
    );
    assert.deepEqual(doc.pages, ["https://x.test/a?x=1&y=2", "https://x.test/b"]);
    assert.deepEqual(parseSitemap(`<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>`).sitemaps, [
      "https://x.test/s1.xml",
    ]);
  });
});

/* ------------------------------------------------------------------ */

let server: http.Server;
let origin = "";
const requests: Array<{ path: string; auth: string | undefined; xtest: string | undefined }> = [];
/** Per-path body overrides, to simulate a deploy between two runs. */
const overrides = new Map<string, string>();

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".json": "application/json" };

before(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    requests.push({ path: url.pathname, auth: req.headers.authorization, xtest: req.headers["x-test"] as string | undefined });
    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end(`User-agent: *\nDisallow: /private/\nSitemap: ${origin}/sitemap.xml\n`);
    }
    if (url.pathname === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml" });
      return res.end(`<urlset><url><loc>${origin}/orphan.html</loc></url><url><loc>${origin}/</loc></url></urlset>`);
    }
    if (url.pathname.startsWith("/staging/") && req.headers.authorization !== `Basic ${Buffer.from("user:pass").toString("base64")}`) {
      res.writeHead(401, { "www-authenticate": 'Basic realm="staging"', "content-type": "text/plain" });
      return res.end("auth required");
    }
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const body = overrides.get(rel);
    if (body !== undefined) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(body);
    }
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await closeBrowser();
  await new Promise<void>((r) => server.close(() => r()));
});

const crawl = (extra: Partial<Parameters<typeof crawlSite>[0]> = {}) =>
  crawlSite({ start: `${origin}/`, rules: registry.axeIds(), maxDepth: 2, concurrency: 3, timeoutMs: 15_000, ...extra });

const page = (r: SiteResult, p: string) => r.pages.find((x) => x.url === `${origin}${p}`);

describe("crawlSite", () => {
  let r: SiteResult;
  let shots: string;
  before(async () => {
    shots = await mkdtemp(path.join(os.tmpdir(), "a11yfix-shots-"));
    requests.length = 0;
    r = await crawl({ screenshotsDir: shots, maxDepth: 1 });
  });

  it("stays within the depth limit and the origin", () => {
    assert.equal(page(r, "/deep/level2.html")?.status, "audited");
    assert.equal(page(r, "/deep/level3.html"), undefined);
    assert.ok(r.pages.every((p) => p.url.startsWith(origin)));
    assert.equal(page(r, "/brochure.pdf"), undefined);
  });

  it("honours robots.txt without requesting disallowed pages", () => {
    assert.equal(page(r, "/private/secret.html")?.status, "skipped");
    assert.ok(!requests.some((q) => q.path.startsWith("/private/")));
  });

  it("finds pages listed only in the sitemap", () => assert.equal(page(r, "/orphan.html")?.status, "audited"));

  it("audits a page once when two URLs render the same DOM", () => {
    const dup = page(r, "/index.html");
    assert.equal(dup?.status, "duplicate");
    assert.equal(dup?.duplicateOf, `${origin}/`);
  });

  it("renders pages with their scripts before auditing", () => {
    const app = page(r, "/app.html");
    assert.equal(app?.status, "audited");
    assert.ok(app!.findings.some((f) => f.ruleId === "image-alt" && f.outerHTML.includes("chart.png")), "script-inserted image found");
  });

  it("blocks requests to other origins", () => assert.ok(page(r, "/app.html")!.blockedRequests >= 1));

  it("records HTTP errors as skipped", () => {
    // /staging/ is not linked; crawl it directly without credentials.
    return crawl({ start: `${origin}/staging/index.html`, maxDepth: 0, useSitemap: false }).then((s) => {
      assert.equal(s.pages[0]?.status, "skipped");
      assert.equal(s.pages[0]?.reason, "HTTP 401");
    });
  });

  it("groups the same issue across pages (template candidates)", () => {
    const g = sharedGroups(r).find((x) => x.ruleId === "image-alt" && x.html.includes("logo.png"));
    assert.ok(g, "the header logo is reported as one shared issue");
    assert.ok(g!.pages.length >= 4);
  });

  it("captures the element of each finding", () => {
    const withShot = r.pages.flatMap((p) => p.findings).filter((f) => f.screenshot);
    assert.ok(withShot.length > 0);
    for (const f of withShot) assert.ok(existsSync(path.join(shots, f.screenshot!)), f.screenshot!);
  });

  it("writes a report", () => {
    const md = renderSiteReport(r, registry);
    assert.match(md, /does not guarantee WCAG conformance/);
    assert.match(md, /Repeated across pages/);
  });
});

describe("crawlSite options", () => {
  it("audits several viewports and says where each finding appears", async () => {
    const r = await crawl({ maxDepth: 0, useSitemap: false, viewports: [VIEWPORTS.desktop!, VIEWPORTS.mobile!] });
    const home = r.pages[0]!;
    assert.deepEqual(home.viewports, ["desktop", "mobile"]);
    const menu = home.findings.find((f) => f.outerHTML.includes("menu.png"));
    assert.deepEqual(menu?.viewports, ["mobile"], "the menu icon is hidden on desktop");
    const logo = home.findings.find((f) => f.outerHTML.includes("logo.png"));
    assert.deepEqual(logo?.viewports, ["desktop", "mobile"]);
  });

  it("sends basic auth and headers to the target origin", async () => {
    requests.length = 0;
    const r = await crawl({
      start: `${origin}/staging/index.html`,
      maxDepth: 0,
      useSitemap: false,
      auth: { basic: { username: "user", password: "pass" }, headers: { "x-test": "1" } },
    });
    assert.equal(r.pages[0]?.status, "audited");
    assert.ok(r.pages[0]!.findings.some((f) => f.ruleId === "image-alt"));
    assert.ok(requests.some((q) => q.path === "/staging/index.html" && q.xtest === "1"));
  });

  it("ignores robots.txt only when told to", async () => {
    const r = await crawl({ start: `${origin}/private/secret.html`, maxDepth: 0, useSitemap: false, respectRobots: false });
    assert.equal(r.pages[0]?.status, "audited");
  });

  it("respects --max-pages", async () => {
    const r = await crawl({ maxPages: 2 });
    assert.equal(r.pages.filter((p) => p.status !== "skipped").length, 2);
  });
});

const hasSqlite = await import("node:sqlite").then(
  () => true,
  () => false,
);

describe("storage and incremental runs", { skip: hasSqlite ? false : "node:sqlite needs Node >= 22.13" }, () => {
  it("reuses unchanged pages and re-audits changed ones", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "a11yfix-db-"));
    const store = await Store.open(path.join(dir, "a11yfix.sqlite"));
    try {
      const first = await crawl({ store, incremental: true });
      const audited = first.pages.filter((p) => p.status === "audited").length;
      assert.ok(audited >= 5);

      overrides.set("about.html", (await readFile(path.join(root, "about.html"), "utf8")).replace("<p>Email</p>", "<label>Email <input type=\"email\"></label>"));
      const second = await crawl({ store, incremental: true });
      overrides.clear();

      const about = second.pages.find((p) => p.url.endsWith("/about.html"));
      assert.equal(about?.status, "audited", "changed page is audited again");
      const reused = second.pages.filter((p) => p.status === "reused");
      assert.equal(reused.length, audited - 1);
      // Reused pages keep their findings and their links (the crawl still reaches deep pages).
      const home = second.pages.find((p) => p.url === `${origin}/`);
      assert.equal(home?.status, "reused");
      assert.ok(home!.findings.length > 0);
      assert.equal(second.pages.find((p) => p.url.endsWith("/deep/level2.html"))?.status, "reused");

      const runs = store.query("SELECT kind, stats FROM runs ORDER BY id");
      assert.equal(runs.length, 2);
      assert.equal(JSON.parse(String(runs[1]!.stats)).reused, audited - 1);
    } finally {
      store.close();
    }
  });
});
