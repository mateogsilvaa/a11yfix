// action.yml, the code and docs/github-action.md must agree: every input is
// passed to the code and documented, every output is written and documented.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../../", import.meta.url);
const actionYml = readFileSync(new URL("action.yml", root), "utf8");
const docs = readFileSync(new URL("docs/github-action.md", root), "utf8");
const main = readFileSync(new URL("packages/action/src/main.ts", root), "utf8");

/** Keys directly under a top-level section (two-space indent). */
function keys(section: string): string[] {
  const m = new RegExp(String.raw`^${section}:\n([\s\S]*?)(?=^\S)`, "m").exec(actionYml);
  assert.ok(m, `action.yml has no ${section} section`);
  return Array.from(m[1]!.matchAll(/^ {2}([a-z][a-z-]*):/gm), (x) => x[1]!);
}

const ENV: Record<string, string> = { "github-token": "TOKEN" };

describe("action.yml, code and docs agree", () => {
  it("passes and documents every input", () => {
    const inputs = keys("inputs");
    assert.ok(inputs.includes("fail-on") && inputs.includes("paths") && inputs.includes("mode") && inputs.includes("strict"));
    for (const name of inputs) {
      assert.ok(docs.includes(`| \`${name}\` |`), `docs/github-action.md does not document input ${name}`);
      if (name === "working-directory") {
        assert.ok(actionYml.includes("working-directory: ${{ inputs.working-directory }}"));
        continue;
      }
      const env = `VERIFA11Y_ACTION_${ENV[name] ?? name.toUpperCase().replace(/-/g, "_")}`;
      assert.ok(actionYml.includes(`${env}: \${{ inputs.${name} }}`), `action.yml does not pass ${name} as ${env}`);
      assert.ok(main.includes(`"${env.slice("VERIFA11Y_ACTION_".length)}"`), `main.ts does not read ${env}`);
    }
  });

  it("writes and documents every output", () => {
    for (const name of keys("outputs")) {
      assert.ok(docs.includes(`| \`${name}\` |`), `docs/github-action.md does not document output ${name}`);
      assert.ok(actionYml.includes(`value: \${{ steps.run.outputs.${name} }}`), `action.yml does not map output ${name}`);
      assert.ok(main.includes(`${name.includes("-") ? `"${name}"` : name}:`), `main.ts does not write output ${name}`);
    }
  });

  it("defaults to codemods and to never failing the job", () => {
    assert.match(actionYml, /^ {2}mode:\n[\s\S]*?default: codemod$/m);
    assert.match(actionYml, /^ {2}fail-on:\n[\s\S]*?default: none$/m);
    assert.match(actionYml, /^ {2}strict:\n[\s\S]*?default: "true"$/m);
  });
});
