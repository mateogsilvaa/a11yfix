// Protects a truth of the project, like the sabotage test: an agent copies the
// first line of a result into its summary, so every result must start with the
// conformance warning and carry it in its structured content. If this test
// fails, the server can make an agent tell a user their site is accessible.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { CAVEATS, CONFORMANCE, WARNING } from "a11yfix-mcp";
import type { Client } from "@modelcontextprotocol/client";
import { call, connect, makeRoot } from "./helpers.js";

let root = "";
let client: Client;
before(async () => {
  root = await makeRoot();
  client = await connect(root);
});
after(() => client.close());

function assertWarned(r: { text: string; data: Record<string, any>; isError: boolean }, what: string) {
  assert.ok(r.text.startsWith(WARNING), `${what}: text must start with the warning, got ${JSON.stringify(r.text.slice(0, 80))}`);
  assert.match(WARNING, /not WCAG conformance/);
  assert.match(WARNING, /Do not tell the user the page is accessible/);
  if (!r.isError) {
    assert.equal(r.data.conformance, CONFORMANCE, `${what}: structured conformance field`);
    assert.deepEqual(r.data.caveats, [...CAVEATS], `${what}: structured caveats`);
  }
}

describe("every MCP result carries the conformance warning", () => {
  it("is worded as the project's truth", () => {
    assert.equal(CONFORMANCE, "axe-clean on the checked rules, not WCAG conformance");
    assert.ok(CAVEATS.some((c) => /not a human review/.test(c)));
    assert.ok(CAVEATS.some((c) => /^skipped findings were not fixed/.test(c)));
    assert.ok(CAVEATS.some((c) => /suspicious patches need human review/.test(c)));
    assert.ok(CAVEATS.some((c) => /Do not tell the user that the page is accessible/.test(c)));
  });

  it("rules", async () => assertWarned(await call(client, "rules"), "rules"));
  it("audit", async () => assertWarned(await call(client, "audit", { path: "shop.html" }), "audit"));
  it("fix", async () => assertWarned(await call(client, "fix", { path: "newsletter.html" }), "fix"));
  it("verify", async () => {
    const a = await call(client, "audit", { path: "shop.html" });
    const f = a.data.findings.find((x: any) => x.ruleId === "image-alt");
    const r = await call(client, "verify", {
      path: "shop.html",
      patch: { findingId: f.id, before: '<img src="kettle.png" width="120" height="80">', after: '<img src="kettle.png" width="120" height="80" alt="">' },
    });
    assertWarned(r, "verify");
  });
  it("errors too", async () => assertWarned(await call(client, "audit", { path: "missing.html" }), "error"));

  it("the prompt forbids claiming the page is accessible", async () => {
    const p = await client.getPrompt({ name: "fix-accessibility", arguments: { path: "shop.html" } });
    const t = (p.messages[0]!.content as { text: string }).text;
    assert.match(t, /Never write "the page is accessible now"/);
    assert.match(t, /git apply/);
    assert.match(t, /review/);
  });
});
