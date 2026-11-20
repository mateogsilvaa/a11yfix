// Engine versions recorded in every report. A benchmark is only comparable
// with another run that used the same engines (axe-core and Playwright are
// pinned to exact versions in package.json for that reason).

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function versionOf(pkg: string): string {
  try {
    return (require(`${pkg}/package.json`) as { version: string }).version;
  } catch {
    return "unknown";
  }
}

export function engineVersions(): Record<string, string> {
  return {
    "verifa11y-core": versionOf("verifa11y-core"),
    "axe-core": versionOf("axe-core"),
    playwright: versionOf("playwright"),
    node: process.versions.node,
  };
}
