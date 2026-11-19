// Cross-platform test runner: shells on Windows do not expand globs, and
// Node 20's --test does not accept glob patterns. Usage: node scripts/test.mjs [filter]
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const filter = process.argv[2] ?? "";
const files = [];
for (const pkg of readdirSync("packages")) {
  const dir = path.join("packages", pkg, "test");
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".test.ts") && f.includes(filter)) files.push(path.join(dir, f));
}
if (files.length === 0) {
  console.error(`no test files match "${filter}"`);
  process.exit(1);
}
const r = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
