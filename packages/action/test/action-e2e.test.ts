// The action end to end: a real git checkout, the real CLI and browser, and a
// fake GitHub API on 127.0.0.1 (nothing leaves the machine). Checks what a
// pull request would see: suggestions on the head's lines that `git apply`
// agrees with, no duplicate review on a re-run, the job summary for forks,
// and a hard stop when the checkout is not the pull request head.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { CAVEATS, WARNING } from "verifa11y-core";
import { REVIEW_MARKER } from "verifa11y-action";

const MAIN = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const PAGE = fileURLToPath(new URL("../../../corpus/handwritten/02-newsletter-labels.html", import.meta.url));

interface Posted {
  commit_id: string;
  event: string;
  body: string;
  comments: Array<{ path: string; line: number; start_line?: number; side: string; body: string }>;
}

let repo = "";
let headSha = "";
let lines = 0;
let server: Server;
let api = "";
const posted: Posted[] = [];
const reviews: Array<{ id: number; body: string; commit_id: string; html_url: string }> = [];
const comments: Array<{ body: string }> = [];

const git = (...args: string[]) => {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

before(async () => {
  repo = await mkdtemp(path.join(os.tmpdir(), "verifa11y-action-"));
  await mkdir(path.join(repo, "site"));
  await copyFile(PAGE, path.join(repo, "site", "newsletter.html"));
  await writeFile(path.join(repo, "README.md"), "not html\n");
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "page");
  headSha = git("rev-parse", "HEAD");
  const src = await readFile(path.join(repo, "site", "newsletter.html"), "utf8");
  lines = src.split("\n").length - (src.endsWith("\n") ? 1 : 0);

  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    assert.equal(req.headers.authorization, "Bearer test-token");
    if (req.method === "GET" && url.pathname === "/repos/o/r/pulls/5/files") {
      return send(200, [
        { filename: "site/newsletter.html", status: "added", patch: `@@ -0,0 +1,${lines} @@\n+…` },
        { filename: "README.md", status: "added", patch: "@@ -0,0 +1 @@\n+not html" },
        { filename: "gone.html", status: "removed" },
      ]);
    }
    if (req.method === "GET" && url.pathname === "/repos/o/r/pulls/5/reviews") return send(200, reviews);
    if (req.method === "GET" && url.pathname === "/repos/o/r/pulls/5/comments") return send(200, comments);
    if (req.method === "POST" && url.pathname === "/repos/o/r/pulls/5/reviews") {
      let raw = "";
      req.on("data", (c: Buffer) => (raw += c.toString("utf8")));
      req.on("end", () => {
        const p = JSON.parse(raw) as Posted;
        posted.push(p);
        const r = { id: reviews.length + 1, body: p.body, commit_id: p.commit_id, html_url: `https://github.example/o/r/pull/5#review-${reviews.length + 1}` };
        reviews.push(r);
        comments.push(...p.comments.map((c) => ({ body: c.body })));
        send(200, r);
      });
      return;
    }
    send(404, { message: `unexpected ${req.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function runAction(o: { headRepo?: string; sha?: string; failOn?: string; tag: string }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), `verifa11y-action-${o.tag}-`));
  const event = path.join(dir, "event.json");
  await writeFile(
    event,
    JSON.stringify({ pull_request: { number: 5, head: { sha: o.sha ?? headSha, repo: { full_name: o.headRepo ?? "o/r" } }, base: { repo: { full_name: "o/r" } } } }),
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GITHUB_EVENT_PATH: event,
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "o/r",
    GITHUB_API_URL: api,
    GITHUB_STEP_SUMMARY: path.join(dir, "summary.md"),
    GITHUB_OUTPUT: path.join(dir, "output.txt"),
    RUNNER_TEMP: dir,
    VERIFA11Y_ACTION_TOKEN: "test-token",
    VERIFA11Y_ACTION_FAIL_ON: o.failOn ?? "none",
  };
  const child = spawn(process.execPath, [MAIN], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (c: Buffer) => (out += c.toString("utf8")));
  child.stderr.on("data", (c: Buffer) => (out += c.toString("utf8")));
  const code = await new Promise<number>((resolve) => child.on("close", (c) => resolve(c ?? 1)));
  const read = (f: string) => readFile(path.join(dir, f), "utf8").catch(() => "");
  const outputs = Object.fromEntries(
    (await read("output.txt"))
      .split("\n")
      .filter(Boolean)
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  return { code, out, summary: await read("summary.md"), outputs, dir };
}

describe("GitHub Action end to end (fake API on localhost)", { timeout: 300_000 }, () => {
  it("posts one review of verified suggestions on the head's lines", async () => {
    const r = await runAction({ tag: "post" });
    assert.equal(r.code, 0, r.out);
    assert.equal(posted.length, 1, r.out);
    const p = posted[0]!;
    assert.equal(p.commit_id, headSha);
    assert.equal(p.event, "COMMENT");
    assert.ok(p.body.startsWith(REVIEW_MARKER));
    assert.ok(p.body.includes(WARNING));
    assert.ok(p.comments.length > 0, "the codemods fix at least one label on this page");
    for (const c of p.comments) {
      assert.equal(c.path, "site/newsletter.html");
      assert.equal(c.side, "RIGHT");
      assert.ok(c.line >= 1 && c.line <= lines, `line ${c.line} outside 1..${lines}`);
      assert.ok(c.body.includes("```suggestion\n"));
      assert.ok(c.body.includes(WARNING));
      for (const caveat of CAVEATS) assert.ok(c.body.includes(caveat));
    }
    assert.equal(Number(r.outputs.suggested), p.comments.reduce((n, c) => n + (c.body.match(/^- `/gm)?.length ?? 0), 0));
    assert.ok(Number(r.outputs.findings) >= Number(r.outputs.verified));
    assert.ok(r.summary.includes("### verifa11y accessibility review"));

    // The patch the action writes applies to the checkout as is.
    const patch = r.outputs.patch!;
    assert.ok((await readFile(patch, "utf8")).includes("diff --git a/site/newsletter.html b/site/newsletter.html"));
    git("apply", "--check", patch);

    const results = JSON.parse(await readFile(r.outputs.results!, "utf8")) as { conformance: string };
    assert.equal(results.conformance, "axe-clean on the checked rules, not WCAG conformance");

    // Accepting every suggestion gives the same file as the verified patch.
    assert.equal(r.outputs.suggested, r.outputs.verified, "every verified fix on this page is on a changed line");
    const edited = (await readFile(path.join(repo, "site", "newsletter.html"), "utf8")).replace(/\r\n/g, "\n").split("\n");
    for (const c of [...p.comments].sort((a, b) => b.line - a.line)) {
      const m = /\n(`{3,})suggestion\n([\s\S]*?)\n?\1\n/.exec(c.body)!;
      const start = (c.start_line ?? c.line) - 1;
      edited.splice(start, c.line - start, ...(m[2] === "" ? [] : m[2]!.split("\n")));
    }
    const copy = path.join(r.dir, "copy");
    await mkdir(path.join(copy, "site"), { recursive: true });
    await copyFile(path.join(repo, "site", "newsletter.html"), path.join(copy, "site", "newsletter.html"));
    const applied = spawnSync("git", ["apply", patch], { cwd: copy, encoding: "utf8" });
    assert.equal(applied.status, 0, applied.stderr);
    const viaPatch = (await readFile(path.join(copy, "site", "newsletter.html"), "utf8")).replace(/\r\n/g, "\n");
    assert.equal(edited.join("\n"), viaPatch);
  });

  it("does not post the same review twice", async () => {
    const r = await runAction({ tag: "again" });
    assert.equal(r.code, 0, r.out);
    assert.equal(posted.length, 1, "nothing changed, so no second review");
    assert.match(r.out, /nothing changed since the last verifa11y review/);
  });

  it("writes the job summary instead of posting on a fork pull request, and honours fail-on", async () => {
    const r = await runAction({ tag: "fork", headRepo: "someone/r", failOn: "findings" });
    assert.equal(posted.length, 1, "a read-only token never posts");
    assert.match(r.summary, /comes from a fork, so the workflow token is read-only/);
    assert.ok(r.summary.includes("```diff\n"));
    assert.ok(r.summary.includes(WARNING));
    assert.equal(r.code, 1, "fail-on: findings with findings present");
    assert.match(r.out, /::error::verifa11y: \d+ finding\(s\)/);
  });

  it("refuses to comment when the checkout is not the pull request head", async () => {
    const r = await runAction({ tag: "merge", sha: "0".repeat(40) });
    assert.equal(r.code, 1);
    assert.match(r.out, /not the pull request head/);
    assert.match(r.out, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    assert.equal(posted.length, 1);
  });
});
