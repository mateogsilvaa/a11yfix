// Runs before `npm pack` / `npm publish` in each published package (cwd = the package).
// Copies the repository's LICENSE and NOTICE into the package, as Apache-2.0 requires for
// redistribution, and refuses to pack a package whose build is missing or older than its sources.
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const pkg = process.cwd();
const root = path.resolve(pkg, "../..");
for (const f of ["LICENSE", "NOTICE"]) copyFileSync(path.join(root, f), path.join(pkg, f));

const newest = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((t, e) => {
    const p = path.join(dir, e.name);
    return Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }, 0);
if (!existsSync(path.join(pkg, "dist")) || newest(path.join(pkg, "src")) > newest(path.join(pkg, "dist"))) {
  console.error(`${path.basename(pkg)}: dist/ is missing or older than src/. Run \`npm run build\` at the repository root first.`);
  process.exit(1);
}
