// The GitHub Action's promise, without the network: a verified patch becomes
// exactly one suggestion on exactly the lines it changes, every comment and
// the review body carry the caveats verbatim, and nothing that is not
// verified is ever suggested.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAVEATS, CONFORMANCE, WARNING, type Finding, type Patch, type VerificationStatus } from "verifa11y-core";
import {
  GitHub,
  GitHubError,
  REVIEW_MARKER,
  SUGGESTION_MARKER,
  bodyOnlyPayload,
  fenceFor,
  globToRegExp,
  matchesAny,
  parsePatterns,
  planReview,
  reviewPayload,
  rightHunks,
  suggestionKey,
  type FileReport,
  type FindingResult,
  type RunInfo,
} from "verifa11y-action";

const RUN: RunInfo = { mode: "codemod", strict: true, version: "0.4.0", generator: null, notAudited: [] };

function finding(id: string, src: string, snippet: string, ruleId = "aria-roles", file = "site/index.html"): Finding {
  const start = src.indexOf(snippet);
  assert.ok(start >= 0, `snippet ${snippet} not in source`);
  const line = src.slice(0, start).split("\n").length;
  return {
    id,
    ruleId,
    wcag: ["4.1.2"],
    impact: "critical",
    selector: "nav",
    nodeIndex: 0,
    outerHTML: snippet,
    sourceSnippet: snippet,
    ancestorChain: [],
    sourceFile: file,
    sourceLines: { start: line, end: line + snippet.split("\n").length - 1 },
    sourceRange: { start, end: start + snippet.length },
    help: "ARIA roles used must conform to valid values",
    description: "",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.14/aria-roles",
    failureSummary: "",
    checks: [],
    context: { tagName: "nav", attributes: {}, text: "", nearbyText: "", computedStyle: {} },
  };
}

function result(f: Finding, before: string, after: string, status: VerificationStatus = "verified", reason: string | null = null): FindingResult {
  const patch: Patch = { findingId: f.id, rationale: "the role is misspelled", before, after, confidence: "high" };
  return { finding: f, status, reason, tier: 0, patch };
}

const SRC = [
  "<!doctype html>", // 1
  '<html lang="en">', // 2
  "<body>", // 3
  '  <nav role="navigaton">', // 4
  '    <a href="/">Home</a>', // 5
  "  </nav>", // 6
  "  <main>", // 7
  "    <h1>Garden</h1>", // 8
  "    <h3>Rent a plot</h3>", // 9
  "    <p>Plots cost 40 EUR.</p>", // 10
  "    <h4>Waiting list</h4>", // 11
  "  </main>", // 12
  "</body>", // 13
  "</html>", // 14
  "",
].join("\n");

const ALL_LINES = [{ start: 1, end: 14 }];

describe("a verified patch becomes a suggestion comment", () => {
  it("produces the exact review payload for a known patch", () => {
    const f = finding("f_0001", SRC, '<nav role="navigaton">');
    const file: FileReport = { path: "site/index.html", src: SRC, hunks: ALL_LINES, results: [result(f, '<nav role="navigaton">', '<nav role="navigation">')] };
    const plan = planReview([file], RUN);
    const payload = reviewPayload(plan, "0123456789abcdef0123456789abcdef01234567");

    assert.equal(payload.commit_id, "0123456789abcdef0123456789abcdef01234567");
    assert.equal(payload.event, "COMMENT");
    assert.equal(payload.comments.length, 1);
    const [c] = payload.comments;
    assert.equal(c!.path, "site/index.html");
    assert.equal(c!.line, 4);
    assert.equal(c!.side, "RIGHT");
    assert.equal(c!.start_line, undefined, "a one-line fix is a single-line comment");
    assert.equal(c!.start_side, undefined);

    const key = suggestionKey("site/index.html", '  <nav role="navigaton">', '  <nav role="navigation">');
    assert.ok(c!.body.startsWith(`${SUGGESTION_MARKER} ${key} -->\n`), "a content key, so the same suggestion is never posted twice");
    // The suggestion replaces the whole line, indentation included.
    assert.ok(c!.body.includes('\n```suggestion\n  <nav role="navigation">\n```\n'), c!.body);
    assert.ok(c!.body.includes("`aria-roles` (WCAG 4.1.2), critical, finding `f_0001`"));
    assert.ok(c!.body.includes("Fix by tier 0 codemod, confidence high: the role is misspelled"));
    // What was verified, that skipped and suspicious need a human, not conformance: in every comment.
    assert.ok(c!.body.includes(`> ${WARNING}`));
    for (const caveat of CAVEATS) assert.ok(c!.body.includes(`- ${caveat}`), `comment lacks caveat: ${caveat}`);

    assert.ok(payload.body.startsWith(`${REVIEW_MARKER} ${plan.digest} -->\n`));
    assert.ok(payload.body.includes(`> ${WARNING}`));
    for (const caveat of CAVEATS) assert.ok(payload.body.includes(`- ${caveat}`), `body lacks caveat: ${caveat}`);
    assert.ok(payload.body.includes(CONFORMANCE));
    assert.ok(payload.body.includes("| Verified and suggested inline | 1 |"));
    assert.deepEqual(plan.counts, {
      files: 1,
      findings: 1,
      verified: 1,
      suggested: 1,
      verifiedElsewhere: 0,
      suspicious: 0,
      rejected: 0,
      skipped: 0,
      errors: 0,
      unfixed: 0,
    });
  });

  it("spans exactly the lines of a multi-line fix, in one hunk", () => {
    const before = "<h3>Rent a plot</h3>\n    <p>Plots cost 40 EUR.</p>\n    <h4>Waiting list</h4>";
    const after = "<h2>Rent a plot</h2>\n    <p>Plots cost 40 EUR.</p>\n    <h3>Waiting list</h3>";
    const f = finding("f_0002", SRC, "<h3>Rent a plot</h3>", "heading-order");
    const file: FileReport = { path: "site/index.html", src: SRC, hunks: [{ start: 7, end: 12 }], results: [result(f, before, after)] };
    const { comments } = planReview([file], RUN);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]!.start_line, 9);
    assert.equal(comments[0]!.start_side, "RIGHT");
    assert.equal(comments[0]!.line, 11);
    assert.ok(comments[0]!.body.includes("```suggestion\n    <h2>Rent a plot</h2>\n    <p>Plots cost 40 EUR.</p>\n    <h3>Waiting list</h3>\n```"));
  });

  it("does not suggest outside the lines the pull request changes, but still reports the fix", () => {
    const f = finding("f_0001", SRC, '<nav role="navigaton">');
    const file: FileReport = { path: "site/index.html", src: SRC, hunks: [{ start: 8, end: 12 }], results: [result(f, '<nav role="navigaton">', '<nav role="navigation">')] };
    const plan = planReview([file], RUN);
    assert.equal(plan.comments.length, 0);
    assert.equal(plan.unplaced.length, 1);
    assert.match(plan.unplaced[0]!.why, /line 4 is outside the lines this pull request changes/);
    assert.match(plan.unplaced[0]!.diff, /^-  <nav role="navigaton">$/m);
    assert.match(plan.unplaced[0]!.diff, /^\+  <nav role="navigation">$/m);
    assert.ok(plan.body.includes("#### Verified, but not suggested inline (1)"));
    assert.equal(plan.counts.verifiedElsewhere, 1);
    assert.equal(plan.counts.unfixed, 0, "verified, so it is fixed by the patch");
  });

  it("never suggests suspicious, rejected or skipped findings; lists them for a human", () => {
    const nav = finding("f_0001", SRC, '<nav role="navigaton">');
    const h = finding("f_0002", SRC, "<h3>Rent a plot</h3>", "heading-order");
    const a = finding("f_0003", SRC, '<a href="/">Home</a>', "link-name");
    const file: FileReport = {
      path: "site/index.html",
      src: SRC,
      hunks: ALL_LINES,
      results: [
        result(nav, '<nav role="navigaton">', '<nav role="presentation">', "rejected_suspicious", "the role hides the element"),
        result(h, "<h3>Rent a plot</h3>", "<h2>Rent a plot</h2>", "rejected_regression", "new violation: heading-order"),
        { finding: a, status: "skipped", reason: "needs judgment; no model configured", tier: null, patch: null },
      ],
    };
    const plan = planReview([file], RUN);
    assert.equal(plan.comments.length, 0);
    assert.ok(!plan.body.includes("```suggestion"));
    assert.ok(plan.body.includes("#### Suspicious: need a human (1)"));
    assert.ok(plan.body.includes("`site/index.html:4` `aria-roles` `f_0001`: the role hides the element"));
    assert.ok(plan.body.includes("#### Rejected by the verifier (1)"));
    assert.ok(plan.body.includes("#### Skipped: need a human (1)"));
    assert.equal(plan.counts.unfixed, 3);
  });

  it("merges fixes on one line and drops a fix that edits the same code", () => {
    const src = '<p><img src="a.png"><img src="b.png"></p>\n';
    const a = finding("f_0001", src, '<img src="a.png">', "image-alt", "a.html");
    const b = finding("f_0002", src, '<img src="b.png">', "image-alt", "a.html");
    const c = finding("f_0003", src, '<img src="a.png">', "image-alt", "a.html");
    const file: FileReport = {
      path: "a.html",
      src,
      hunks: [{ start: 1, end: 1 }],
      results: [
        result(a, '<img src="a.png">', '<img src="a.png" alt="Apple">'),
        result(b, '<img src="b.png">', '<img src="b.png" alt="Banana">'),
        result(c, '<img src="a.png">', '<img src="a.png" alt="">'),
      ],
    };
    const plan = planReview([file], RUN);
    assert.equal(plan.comments.length, 1, "one line, one suggestion: a batch can apply it");
    assert.ok(plan.comments[0]!.body.includes('```suggestion\n<p><img src="a.png" alt="Apple"><img src="b.png" alt="Banana"></p>\n```'));
    assert.ok(plan.comments[0]!.body.includes("verified fixes (2, combined because they touch the same lines)"));
    assert.equal(plan.unplaced.length, 1);
    assert.equal(plan.unplaced[0]!.fix.finding.id, "f_0003");
    assert.match(plan.unplaced[0]!.why, /same code as another verified fix/);
  });

  it("never lets generator text mention people or inject HTML", () => {
    const f = finding("f_0001", SRC, '<nav role="navigaton">');
    const r = result(f, '<nav role="navigaton">', '<nav role="navigation">');
    r.patch = { ...r.patch!, rationale: "ask @octocat <script>x</script>" };
    const { comments } = planReview([{ path: "site/index.html", src: SRC, hunks: ALL_LINES, results: [r] }], RUN);
    assert.ok(comments[0]!.body.includes("ask @​octocat &lt;script&gt;x&lt;/script&gt;"));
    assert.ok(!/@octocat/.test(comments[0]!.body));
  });

  it("keeps CRLF files on the right lines and suggests LF text", () => {
    const src = SRC.replace(/\n/g, "\r\n");
    const f = finding("f_0001", src, '<nav role="navigaton">');
    const file: FileReport = { path: "site/index.html", src, hunks: ALL_LINES, results: [result(f, '<nav role="navigaton">', '<nav role="navigation">')] };
    const { comments } = planReview([file], RUN);
    assert.equal(comments[0]!.line, 4);
    assert.ok(comments[0]!.body.includes('```suggestion\n  <nav role="navigation">\n```'));
    assert.ok(!comments[0]!.body.includes("\r"));
  });

  it("uses a longer fence when the replacement contains backticks", () => {
    assert.equal(fenceFor("plain"), "```");
    assert.equal(fenceFor("a ```` b"), "`````");
    const src = "<p>use ```x``` here</p>\n<img src=a.png>\n";
    const f = finding("f_0001", src, "<img src=a.png>", "image-alt", "b.html");
    const file: FileReport = { path: "b.html", src, hunks: [{ start: 1, end: 2 }], results: [result(f, "<img src=a.png>", '<img src=a.png alt="```">')] };
    const { comments } = planReview([file], RUN);
    assert.ok(comments[0]!.body.includes('````suggestion\n<img src=a.png alt="```">\n````'));
  });

  it("falls back to a body-only review with every suggestion as a diff", () => {
    const f = finding("f_0001", SRC, '<nav role="navigaton">');
    const file: FileReport = { path: "site/index.html", src: SRC, hunks: ALL_LINES, results: [result(f, '<nav role="navigaton">', '<nav role="navigation">')] };
    const plan = planReview([file], RUN);
    const p = bodyOnlyPayload(plan, "abc");
    assert.equal(p.comments.length, 0);
    assert.ok(p.body.includes('```diff\n-  <nav role="navigaton">\n+  <nav role="navigation">\n```'));
    assert.ok(plan.summary.includes('-  <nav role="navigaton">'), "the job summary shows suggestions as diffs (fork pull requests)");
    assert.ok(plan.summary.includes(`> ${WARNING}`));
  });

  it("says a clean audit is not a WCAG review", () => {
    const plan = planReview([{ path: "a.html", src: "<p>hi</p>\n", hunks: ALL_LINES, results: [] }], RUN);
    assert.match(plan.body, /found no violations of the rules it checks .* That is not a review of the rest of WCAG/);
    assert.ok(plan.body.includes(WARNING));
  });
});

describe("pull request diff and path filters", () => {
  it("reads new-side hunk ranges", () => {
    const patch = "@@ -1,3 +1,4 @@\n a\n+b\n c\n d\n@@ -10 +11,0 @@\n-x\n@@ -20,2 +21 @@ heading\n-y\n z";
    assert.deepEqual(rightHunks(patch), [
      { start: 1, end: 4 },
      { start: 21, end: 21 },
    ]);
  });

  it("matches globs like on.pull_request.paths", () => {
    const p = parsePatterns("**/*.html\n**/*.htm, # comment\n!vendor/**");
    assert.deepEqual(p, ["**/*.html", "**/*.htm", "!vendor/**"]);
    assert.ok(matchesAny("index.html", p));
    assert.ok(matchesAny("docs/a/b.htm", p));
    assert.ok(!matchesAny("vendor/x.html", p));
    assert.ok(!matchesAny("index.html.bak", p));
    assert.ok(globToRegExp("site/{a,b}/*.html").test("site/b/x.html"));
    assert.ok(!globToRegExp("site/*.html").test("site/sub/x.html"));
    assert.ok(globToRegExp("page[0-9].html").test("page3.html"));
  });
});

describe("GitHub client", () => {
  it("pages through list endpoints and reports errors with their status", async () => {
    const calls: string[] = [];
    const fake = (async (url: string | URL, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(url)}`);
      const u = new URL(String(url));
      if (u.pathname.endsWith("/reviews") && init?.method === "POST") {
        return new Response(JSON.stringify({ message: "Resource not accessible by integration" }), { status: 403 });
      }
      const page = Number(u.searchParams.get("page"));
      const items = page === 1 ? Array.from({ length: 100 }, (_, i) => ({ filename: `f${i}.html`, status: "added" })) : [{ filename: "last.html", status: "added" }];
      return new Response(JSON.stringify(items), { status: 200 });
    }) as typeof fetch;
    const gh = new GitHub({ token: "t", repo: "o/r", apiUrl: "https://ghes.example/api/v3/", fetch: fake });
    const files = await gh.listFiles(7);
    assert.equal(files.length, 101);
    assert.deepEqual(calls, ["GET https://ghes.example/api/v3/repos/o/r/pulls/7/files?per_page=100&page=1", "GET https://ghes.example/api/v3/repos/o/r/pulls/7/files?per_page=100&page=2"]);
    await assert.rejects(gh.createReview(7, {}), (e: unknown) => e instanceof GitHubError && e.status === 403 && /not accessible/.test(e.message));
  });
});
