#!/usr/bin/env node
// a11yfix MCP server over stdio.
//
//   a11yfix-mcp [--root DIR]...    (default root: the current directory)
//
// stdout belongs to the MCP protocol: everything else goes to stderr.

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { closeBrowser } from "a11yfix-core";
import { createServer, mcpEngine } from "./index.js";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.error(
    "usage: a11yfix-mcp [--root DIR]...\n" +
      "Serves the a11yfix tools (rules, audit, fix, verify) over stdio. Files are read and written only inside the roots.",
  );
  process.exit(0);
}
const roots: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root" && args[i + 1]) roots.push(args[++i]!);
}
if (process.env.A11YFIX_MCP_ROOT) roots.push(...process.env.A11YFIX_MCP_ROOT.split(","));

const handle = serveStdio(() => createServer({ roots }), {
  onerror: (err) => console.error(`a11yfix-mcp: ${err.message}`),
});

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await Promise.resolve(handle)
    .then((h) => h.close())
    .catch(() => {});
  await closeBrowser().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.stdin.on("end", () => void shutdown());

const e = mcpEngine();
console.error(`a11yfix-mcp ${e["a11yfix-mcp"]} (MCP SDK ${e["@modelcontextprotocol/server"]}) ready; roots: ${roots.length ? roots.join(", ") : process.cwd()}`);
