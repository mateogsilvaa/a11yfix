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

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const ORIGIN = "http://verifa11y.local";

let browserPromise: Promise<Browser> | null = null;

/** The only browser verifa11y renders with: Playwright's headless Chromium. */
export const BROWSER = "chromium-headless-shell";

const require = createRequire(import.meta.url);

/** The exact command that installs the browser this Playwright version expects. */
export function browserInstallCommand(): string {
  const { version } = require("playwright/package.json") as { version: string };
  return `npx playwright@${version} install ${BROWSER}`;
}

/**
 * Install the browser with the Playwright CLI that verifa11y depends on, so the
 * revision always matches. Resolves with the installer's exit code.
 */
export function installBrowser(opts: { withDeps?: boolean } = {}): Promise<number> {
  const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
  const args = [cli, "install", ...(opts.withDeps ? ["--with-deps"] : []), BROWSER];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err: unknown) => {
      browserPromise = null;
      const message = err instanceof Error ? err.message : String(err);
      if (/Executable doesn't exist/i.test(message)) {
        throw new Error(
          `verifa11y renders pages in Playwright's headless Chromium, which is not installed.
` +
            `Install it once with:  npx verifa11y install-browser
` +
            `(the same as: ${browserInstallCommand()})`,
        );
      }
      throw err;
    });
  }
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
 * Page scripts never run: verifa11y v1 targets static HTML, and scripts would
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
