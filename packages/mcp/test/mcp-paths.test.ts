// The server renders HTML and writes files on behalf of a remote process: it
// must stay inside its roots, never edit the input, and never let two runs
// write over each other.
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { Client } from "@modelcontextprotocol/client";
import { call, connect, makeRoot } from "./helpers.js";

let root = "";
let outside = "";
let client: Client;
before(async () => {
  root = await makeRoot();
  outside = await mkdtemp(path.join(os.tmpdir(), "verifa11y-outside-"));
  await writeFile(path.join(outside, "secret.html"), "<!doctype html><html lang=en><title>x</title><img src=x.png></html>");
  client = await connect(root);
});
after(() => client.close());

async function trySymlink(target: string, link: string, type: "file" | "junction"): Promise<boolean> {
  try {
    await symlink(target, link, type);
    return true;
  } catch {
    return false; // no symlink privilege (Windows without developer mode)
  }
}

describe("path confinement", () => {
  it("rejects parent-directory traversal", async () => {
    const r = await call(client, "audit", { path: `../${path.basename(outside)}/secret.html` });
    assert.equal(r.isError, true);
    assert.match(r.text, /outside the allowed roots/);
  });

  it("rejects absolute paths outside the roots", async () => {
    const r = await call(client, "audit", { path: path.join(outside, "secret.html") });
    assert.equal(r.isError, true);
    assert.match(r.text, /outside the allowed roots/);
  });

  it("rejects a directory symlink that leads outside", async (t) => {
    if (!(await trySymlink(outside, path.join(root, "escape"), "junction"))) return t.skip("cannot create a junction here");
    const r = await call(client, "audit", { path: "escape/secret.html" });
    assert.equal(r.isError, true);
    assert.match(r.text, /outside the allowed roots/);
  });

  it("rejects a file symlink that leads outside", async (t) => {
    if (!(await trySymlink(path.join(outside, "secret.html"), path.join(root, "link.html"), "file"))) return t.skip("no symlink privilege");
    const r = await call(client, "audit", { path: "link.html" });
    assert.equal(r.isError, true);
  });

  it("rejects files that are not HTML", async () => {
    const r = await call(client, "audit", { path: "notes.txt" });
    assert.equal(r.isError, true);
    assert.match(r.text, /not an .html file/);
  });

  it("rejects files above the size limit", async () => {
    await writeFile(path.join(root, "huge.html"), `<!doctype html><p>${"x".repeat(2_100_000)}</p>`);
    const r = await call(client, "audit", { path: "huge.html" });
    assert.equal(r.isError, true);
    assert.match(r.text, /larger than/);
  });

  it("rejects an output directory outside the roots", async () => {
    const r = await call(client, "fix", { path: "newsletter.html", out: `../${path.basename(outside)}/out` });
    assert.equal(r.isError, true);
    assert.match(r.text, /outside the allowed roots/);
    assert.deepEqual((await readdir(outside)).sort(), ["secret.html"]);
  });
});

describe("writes", () => {
  it("fix never edits the input and writes only under <out>/<runId>/", async () => {
    const before_ = await readFile(path.join(root, "newsletter.html"), "utf8");
    const a = await call(client, "fix", { path: "newsletter.html" });
    const b = await call(client, "fix", { path: "newsletter.html" });
    assert.equal(await readFile(path.join(root, "newsletter.html"), "utf8"), before_, "input file unchanged");
    assert.notEqual(a.data.runId, b.data.runId, "each run gets its own directory");
    for (const r of [a, b]) {
      assert.ok(r.data.patchPath.startsWith(`.verifa11y/${r.data.runId}/`));
      assert.ok((await readFile(path.join(root, r.data.patchPath), "utf8")).startsWith("diff --git a/newsletter.html"));
      assert.deepEqual((await readdir(path.join(root, ".verifa11y", r.data.runId))).sort(), ["results.json", "verifa11y.patch"]);
    }
  });

  it("verify never writes", async () => {
    const list = async () => (await readdir(root)).sort();
    const before_ = await list();
    const a = await call(client, "audit", { path: "shop.html" });
    const f = a.data.findings[0];
    await call(client, "verify", { path: "shop.html", patch: { findingId: f.id, before: "<h1>", after: "<h1 >" } });
    assert.deepEqual(await list(), before_);
  });
});
