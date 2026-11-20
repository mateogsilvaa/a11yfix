// End to end over stdio with the SDK client, as a host runs the server.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { Client } from "@modelcontextprotocol/client";
import { call, connect, makeRoot } from "./helpers.js";

let root = "";
let client: Client;
before(async () => {
  root = await makeRoot();
  client = await connect(root);
});
after(() => client.close());

describe("a11yfix MCP server, end to end", () => {
  it("negotiates the 2026-07-28 revision", () => {
    assert.equal(client.getNegotiatedProtocolVersion(), "2026-07-28");
  });

  it("rules: tiers and what each rule declines", async () => {
    const { data } = await call(client, "rules");
    const label = data.rules.find((r: any) => r.id === "label");
    assert.equal(label.tier, 0);
    assert.equal(label.hasCodemod, true);
    assert.ok(label.declines.length > 0);
    const img = data.rules.find((r: any) => r.id === "image-alt");
    assert.equal(img.hasCodemod, false);
    assert.match(img.declines[0], /^always/);
    assert.ok(data.engine["@modelcontextprotocol/server"]);
    assert.ok(data.engine["axe-core"]);
  });

  it("audit: findings with source lines and tiers", async () => {
    const { data, isError } = await call(client, "audit", { path: "shop.html" });
    assert.equal(isError, false);
    const roles = data.findings.find((f: any) => f.ruleId === "aria-roles");
    assert.equal(roles.hasCodemod, true);
    assert.equal(roles.lines.length, 2);
    assert.ok(data.findings.some((f: any) => f.ruleId === "image-alt" && f.tier === 1));
    const structural = await call(client, "audit", { path: "shop.html", level: 1 });
    assert.ok(!structural.data.findings.some((f: any) => f.ruleId === "color-contrast"));
  });

  it("verify: an honest fix passes, a fake one fails with the reason", async () => {
    const { data: audit } = await call(client, "audit", { path: "shop.html" });
    const img = audit.findings.find((f: any) => f.ruleId === "image-alt");
    const base = '<img src="kettle.png" width="120" height="80">';
    const good = await call(client, "verify", {
      path: "shop.html",
      patch: { findingId: img.id, before: base, after: '<img src="kettle.png" width="120" height="80" alt="Stainless steel electric kettle">' },
    });
    assert.equal(good.data.verification.verified, true, good.data.verification.reason);
    assert.ok(good.data.verification.accessibilityTree && good.data.verification.focus && good.data.verification.visual);
    const fake = await call(client, "verify", {
      path: "shop.html",
      patch: { findingId: img.id, before: base, after: '<img src="kettle.png" width="120" height="80" aria-labelledby="cap">' },
    });
    assert.equal(fake.data.verification.verified, false);
    assert.match(fake.data.verification.reason, /generic name "image"/);
    assert.match(fake.text.split("\n")[2]!, /do not suggest this edit/);
  });

  it("fix: codemod mode by default, strict, a patch git can apply", async () => {
    const { data } = await call(client, "fix", { path: "newsletter.html" });
    assert.equal(data.mode, "codemod");
    assert.equal(data.strict, true);
    assert.ok(data.included.length > 0);
    assert.ok(data.included.every((i: any) => i.status === "verified"));
    assert.equal(data.applyWith, `git apply ${data.patchPath}`);
    assert.equal(data.diff, await readFile(path.join(root, data.patchPath), "utf8"));
    const results = JSON.parse(await readFile(path.join(root, path.dirname(data.patchPath), "results.json"), "utf8"));
    assert.equal(results.conformance, data.conformance);
  });

  it("fix: mode=auto is explicit and fails clearly without a tier-1 generator", async () => {
    const r = await call(client, "fix", { path: "shop.html", mode: "auto" });
    assert.equal(r.isError, true);
    assert.match(r.text, /mode=auto needs a tier-1 generator/);
  });
});
