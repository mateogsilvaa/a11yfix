// One shared headless Chromium for the whole run. Every audit gets its own
// browser context (cheap), so audits can run concurrently without sharing
// state.
//
// Pages are not loaded from file:// URLs. Instead every page is served from a
// fake origin through request interception: the page itself is served from
// memory (so the verifier can audit a patched copy without writing it next to
// the original), and relative resources (CSS, images) are served from the
// original file's directory, so a patched copy renders exactly like the
// original would. Requests to any other origin are aborted, which keeps
// audits offline and deterministic.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const ORIGIN = "http://a11yfix.local";

let browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = chromium.launch({ headless: true });
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b.close();
}

const MIME: Record<string, string> = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".html": "text/html; charset=utf-8",
};

/**
 * Open `html` as if it were the file at `filePath`, run `fn` on the page,
 * and dispose of the context.
 *
 * Page scripts never run: a11yfix v1 targets static HTML, and scripts would
 * make the DOM diverge from the source we patch. We cannot simply disable
 * JavaScript in the context, because then timers stop firing and axe.run()
 * never resolves. Instead the page is served with a CSP of script-src 'none',
 * which blocks every inline and external page script and inline event
 * handler, while code injected over CDP (axe, our evaluate calls) still runs.
 */
export async function withPage<R>(
  filePath: string,
  html: string,
  fn: (page: Page) => Promise<R>,
): Promise<R> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const dir = path.dirname(path.resolve(filePath));
  const pageUrl = `${ORIGIN}/${encodeURIComponent(path.basename(filePath))}`;

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.href.split("#")[0] === pageUrl) {
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": "script-src 'none'",
        },
        body: html,
      });
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const abs = path.resolve(dir, rel);
    if (!abs.startsWith(dir)) return route.fulfill({ status: 404, body: "" });
    try {
      const body = await readFile(abs);
      const type = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
      return route.fulfill({ status: 200, headers: { "content-type": type }, body });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });

  try {
    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate("globalThis.__name = globalThis.__name || ((f) => f)");
    return await fn(page);
  } finally {
    await context.close();
  }
}
