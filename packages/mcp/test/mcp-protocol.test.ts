// Protocol conformance at the wire (no SDK client in between), a snapshot of
// the tool schemas, and a check that the documentation describes the same
// tools and parameters the server exposes.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { call, connect, makeRoot, rawServer } from "./helpers.js";

const SNAPSHOT = fileURLToPath(new URL("./tools.snapshot.json", import.meta.url));
const AGENTS_DOC = fileURLToPath(new URL("../../../docs/agents.md", import.meta.url));

let root = "";
let raw: ReturnType<typeof rawServer>;
before(async () => {
  root = await makeRoot();
  raw = rawServer(root);
});
after(() => raw.close());

describe("protocol 2026-07-28 at the wire", () => {
  it("server/discover announces versions, capabilities and identity", async () => {
    const r = (await raw.send("server/discover")).result;
    assert.ok(r.supportedVersions.includes("2026-07-28"));
    assert.ok(r.capabilities.tools);
    assert.ok(r.capabilities.prompts);
    assert.equal(r._meta["io.modelcontextprotocol/serverInfo"].name, "a11yfix");
    assert.equal(r.resultType, "complete");
  });

  it("tools/list: resultType, cache fields, deterministic order", async () => {
    const a = (await raw.send("tools/list")).result;
    const b = (await raw.send("tools/list")).result;
    assert.equal(a.resultType, "complete");
    assert.equal(typeof a.ttlMs, "number");
    assert.ok(["public", "private"].includes(a.cacheScope));
    assert.deepEqual(a.tools.map((t: any) => t.name), ["rules", "audit", "fix", "verify"]);
    assert.deepEqual(a, b);
  });

  it("prompts/list carries cache fields", async () => {
    const r = (await raw.send("prompts/list")).result;
    assert.equal(r.resultType, "complete");
    assert.equal(typeof r.ttlMs, "number");
    assert.equal(typeof r.cacheScope, "string");
  });

  it("tools/call returns resultType and structured content", async () => {
    const r = (await raw.send("tools/call", { name: "rules", arguments: {} })).result;
    assert.equal(r.resultType, "complete");
    assert.ok(Array.isArray(r.structuredContent.rules));
  });

  it("still serves 2025-era hosts (initialize handshake)", async () => {
    const legacy = await connect(root, "legacy");
    try {
      const tools = (await legacy.listTools()).tools.map((t) => t.name);
      assert.deepEqual(tools, ["rules", "audit", "fix", "verify"]);
      const r = await call(legacy, "rules");
      assert.ok(r.data.rules.length > 0);
    } finally {
      await legacy.close();
    }
  });
});

describe("tool schemas", () => {
  it("match the committed snapshot (update with UPDATE_SNAPSHOTS=1)", async () => {
    const tools = (await raw.send("tools/list")).result.tools;
    const current = `${JSON.stringify(tools, null, 2)}\n`;
    if (process.env.UPDATE_SNAPSHOTS === "1" || !existsSync(SNAPSHOT)) await writeFile(SNAPSHOT, current, "utf8");
    assert.equal(current, await readFile(SNAPSHOT, "utf8"), "tool schemas changed: review the change, update docs/agents.md, then the snapshot");
  });

  it("are all documented in docs/agents.md, parameter by parameter", async () => {
    const doc = await readFile(AGENTS_DOC, "utf8");
    const tools = (await raw.send("tools/list")).result.tools;
    for (const t of tools) {
      assert.ok(doc.includes(`\`${t.name}\``), `docs/agents.md does not mention the ${t.name} tool`);
      for (const p of Object.keys(t.inputSchema.properties ?? {})) {
        assert.ok(doc.includes(`\`${p}\``), `docs/agents.md does not document the ${p} parameter of ${t.name}`);
      }
    }
  });

  it("carry the annotations the contract promises", async () => {
    const tools = Object.fromEntries((await raw.send("tools/list")).result.tools.map((t: any) => [t.name, t]));
    assert.equal(tools.rules.annotations.readOnlyHint, true);
    assert.equal(tools.audit.annotations.readOnlyHint, true);
    assert.equal(tools.audit.annotations.idempotentHint, true);
    assert.equal(tools.verify.annotations.readOnlyHint, true);
    assert.equal(tools.fix.annotations.readOnlyHint, false);
    assert.equal(tools.fix.annotations.destructiveHint, false);
  });
});
