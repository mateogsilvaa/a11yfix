#!/usr/bin/env node
// verifa11y MCP server over stdio.
//
//   verifa11y-mcp [--root DIR]...    (default root: the current directory)
//   verifa11y-mcp --install-browser  (install the headless Chromium it renders with, then exit)
//
// stdout belongs to the MCP protocol: everything else goes to stderr.

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { closeBrowser, installBrowser } from "verifa11y-core";
import { createServer, mcpEngine } from "./index.js";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.error(
    "usage: verifa11y-mcp [--root DIR]...\n       verifa11y-mcp --install-browser\n" +
      "Serves the verifa11y tools (rules, audit, fix, verify) over stdio. Files are read and written only inside the roots.",
  );
  process.exit(0);
}
if (args.includes("--install-browser")) {
  process.exit(await installBrowser());
}
const roots: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root" && args[i + 1]) roots.push(args[++i]!);
}
if (process.env.VERIFA11Y_MCP_ROOT) roots.push(...process.env.VERIFA11Y_MCP_ROOT.split(","));

const handle = serveStdio(() => createServer({ roots }), {
  onerror: (err) => console.error(`verifa11y-mcp: ${err.message}`),
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
console.error(`verifa11y-mcp ${e["verifa11y-mcp"]} (MCP SDK ${e["@modelcontextprotocol/server"]}) ready; roots: ${roots.length ? roots.join(", ") : process.cwd()}`);
