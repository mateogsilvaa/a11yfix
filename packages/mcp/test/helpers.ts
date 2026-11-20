// Shared harness: a temp root with fixture pages and a client speaking to the
// built server binary over stdio, as a real host does.
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export const SERVER = fileURLToPath(new URL("../dist/server.js", import.meta.url));
const shop = fileURLToPath(new URL("../../core/test/fixtures/deep-cases.html", import.meta.url));
const labels = fileURLToPath(new URL("../../../corpus/handwritten/02-newsletter-labels.html", import.meta.url));

export async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "a11yfix-mcp-"));
  await copyFile(shop, path.join(root, "shop.html"));
  await copyFile(labels, path.join(root, "newsletter.html"));
  await writeFile(path.join(root, "notes.txt"), "not html");
  return root;
}

export async function connect(root: string, mode: "modern" | "legacy" = "modern"): Promise<Client> {
  const client = new Client(
    { name: "a11yfix-test", version: "0.0.0" },
    mode === "modern" ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : {},
  );
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER, "--root", root], stderr: "ignore" }));
  return client;
}

export interface ToolResult {
  text: string;
  data: Record<string, any>;
  isError: boolean;
}

export async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";
  return { text, data: (r.structuredContent ?? {}) as Record<string, any>, isError: Boolean(r.isError) };
}

/** Raw JSON-RPC over the server's stdio, with no SDK in between (for wire-level conformance). */
export function rawServer(root: string) {
  const p = spawn(process.execPath, [SERVER, "--root", root], { stdio: ["pipe", "pipe", "ignore"] });
  let buf = "";
  let id = 0;
  const waiting = new Map<number, (m: any) => void>();
  p.stdout.setEncoding("utf8").on("data", (d: string) => {
    buf += d;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const m = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiting.get(m.id)?.(m);
    }
  });
  const meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "raw-test", version: "0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
  return {
    send(method: string, params: Record<string, unknown> = {}): Promise<any> {
      const n = ++id;
      return new Promise((resolve) => {
        waiting.set(n, resolve);
        p.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: n, method, params: { ...params, _meta: meta } })}\n`);
      });
    },
    close() {
      p.kill();
    },
  };
}
