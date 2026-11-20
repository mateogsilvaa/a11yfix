#!/usr/bin/env node
// Records the README demo from real runs: audit, fix, the patch, and one patch the verifier rejects.
// Every line in the output comes from the CLI as it ran; only the pauses between lines are compressed.
//
//   npm run build && node scripts/record-demo.mjs        # writes docs/demo.svg and docs/demo.cast
//
// demo.svg is an animated terminal (CSS keyframes, no script) that GitHub renders in the README.
// demo.cast is the same recording in asciicast v2, for asciinema players.

import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "packages/cli/dist/cli.js");
const COLS = 96;
const ROWS = 24;

// The patch a hurried fixer would write for the map image: alt text from the file name.
const BAD_PATCH = {
  findingId: "f_0005",
  rationale: "Add alt text",
  before: '<img src="plot-map.png" width="260">',
  after: '<img src="plot-map.png" width="260" alt="plot map">',
  confidence: "high",
};

const work = await mkdtemp(path.join(os.tmpdir(), "a11yfix-demo-"));
const events = []; // [seconds, text] with text ending in \n
let clock = 0;
const emit = (text, gap) => {
  clock += gap;
  events.push([clock, text]);
};

async function run(display, args, head = Infinity) {
  emit(`$ ${display}\n`, 0.6);
  clock += 0.9; // "typing"
  const started = Date.now();
  const lines = [];
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: work, env: { ...process.env, NO_COLOR: "1", ANTHROPIC_API_KEY: "" } });
    let buf = "";
    const onData = (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) !== -1) {
        lines.push([(Date.now() - started) / 1000, buf.slice(0, i)]);
        buf = buf.slice(i + 1);
      }
    };
    child.stdout.setEncoding("utf8").on("data", onData);
    child.stderr.setEncoding("utf8").on("data", onData);
    child.on("error", reject);
    child.on("close", () => {
      if (buf) lines.push([(Date.now() - started) / 1000, buf]);
      resolve();
    });
  });
  let last = 0;
  for (const [t, text] of lines.slice(0, head)) {
    emit(`${text}\n`, Math.min(1.2, Math.max(0.05, t - last)));
    last = t;
  }
  return lines.map((l) => l[1]);
}

async function show(display, text, filter = () => true) {
  emit(`$ ${display}\n`, 0.8);
  clock += 0.7;
  for (const line of text.replace(/\r/g, "").split("\n").filter(filter)) emit(`${line}\n`, 0.06);
}

try {
  await copyFile(path.join(ROOT, "demo/before/index.html"), path.join(work, "index.html"));
  await run("a11yfix audit index.html --out findings.json", ["audit", "index.html", "--out", "findings.json"]);
  await run("a11yfix fix findings.json --verify --strict --mode codemod --out patches", [
    "fix",
    "findings.json",
    "--verify",
    "--strict",
    "--mode",
    "codemod",
    "--out",
    "patches",
  ]);
  const patch = await readFile(path.join(work, "patches/a11yfix.patch"), "utf8");
  await show("grep '^[-+][^-+]' patches/a11yfix.patch", patch, (l) => /^[-+][^-+]/.test(l));
  await writeFile(path.join(work, "patch.json"), JSON.stringify(BAD_PATCH, null, 2));
  await show("cat patch.json   # a quick fix someone wrote by hand", JSON.stringify(BAD_PATCH, null, 2));
  const verdict = await run("a11yfix verify index.html patch.json --findings findings.json | head -11", ["verify", "index.html", "patch.json", "--findings", "findings.json"], 11);
  if (!verdict.some((l) => l.includes("rejected_suspicious"))) throw new Error(`expected a rejection, got:\n${verdict.join("\n")}`);
  clock += 6; // hold the last screen

  await writeFile(path.join(ROOT, "docs/demo.cast"), cast(events), "utf8");
  await writeFile(path.join(ROOT, "docs/demo.svg"), svg(events), "utf8");
  console.log(`wrote docs/demo.svg and docs/demo.cast (${events.length} lines, ${clock.toFixed(1)} s)`);
} finally {
  await rm(work, { recursive: true, force: true });
}

function cast(evts) {
  const header = { version: 2, width: COLS, height: ROWS, title: "a11yfix: audit, fix, verify" };
  return [JSON.stringify(header), ...evts.map(([t, s]) => JSON.stringify([Number(t.toFixed(3)), s.replace(/\n/g, "\r\n")]))].join("\n") + "\n";
}

function wrap(line) {
  const out = [];
  let s = line.replace(/\t/g, "  ");
  while (s.length > COLS) {
    out.push(s.slice(0, COLS));
    s = `  ${s.slice(COLS)}`;
  }
  out.push(s);
  return out;
}

function color(line) {
  if (line.startsWith("$ ")) return "cmd";
  if (/^\+(?!\+)/.test(line)) return "add";
  if (/^-(?!-)/.test(line)) return "del";
  if (/rejected|suspicious|restates/.test(line)) return "bad";
  if (/verified/.test(line)) return "ok";
  if (/skipped/.test(line)) return "dim";
  return "";
}

function svg(evts) {
  const total = clock;
  const rows = evts.flatMap(([t, s]) => wrap(s.replace(/\n$/, "")).map((text) => ({ t, text })));
  const LH = 19;
  const CW = 8.43; // advance of a 14px monospace glyph
  const PAD = 16;
  const W = Math.ceil(COLS * CW + 2 * PAD);
  const H = ROWS * LH + 2 * PAD + 24;
  const pctOf = (t) => ((100 * t) / total).toFixed(3);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Lines appear at their time and stay until the loop restarts.
  const css = [];
  const texts = rows.map((r, i) => {
    const p = pctOf(r.t);
    css.push(`@keyframes a${i}{0%,${p}%{opacity:0}${(Number(p) + 0.001).toFixed(3)}%,99.5%{opacity:1}100%{opacity:0}}#l${i}{animation:a${i} ${total.toFixed(2)}s steps(1,end) infinite}`);
    const cls = color(r.text);
    return `<text id="l${i}" x="${PAD}" y="${PAD + 24 + (i + 1) * LH - 5}"${cls ? ` class="${cls}"` : ""} xml:space="preserve">${esc(r.text)}</text>`;
  });
  // Scroll: once the screen is full, every new row moves the content up one row.
  const frames = ["0%{transform:translateY(0)}"];
  rows.forEach((r, i) => {
    const off = Math.max(0, i + 1 - ROWS) * LH;
    if (off > 0) frames.push(`${pctOf(r.t)}%{transform:translateY(-${off}px)}`);
  });
  frames.push(`99.5%{transform:translateY(-${Math.max(0, rows.length - ROWS) * LH}px)}100%{transform:translateY(0)}`);
  css.push(`@keyframes scroll{${frames.join("")}}#content{animation:scroll ${total.toFixed(2)}s steps(1,end) infinite}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
<title id="title">a11yfix demo: audit, fix, verify</title>
<desc id="desc">A terminal recording. a11yfix audits demo/before/index.html and finds 9 violations, fixes 4 with deterministic codemods that the verifier accepts, shows the resulting patch, and then rejects a hand-written patch whose alt text only restates the image file name.</desc>
<style>
text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:14px;fill:#d6dde6}
.cmd{fill:#7cc4ff;font-weight:600}.add{fill:#7ee787}.del{fill:#ff8f8f}.ok{fill:#7ee787}.bad{fill:#ffb86b}.dim{fill:#8b96a3}
${css.join("\n")}
@media (prefers-reduced-motion: reduce){[id^="l"]{animation:none!important;opacity:1}#content{animation:none!important;transform:translateY(-${Math.max(0, rows.length - ROWS) * LH}px)}}
</style>
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<circle cx="${PAD + 6}" cy="${PAD + 4}" r="6" fill="#ff5f56"/><circle cx="${PAD + 26}" cy="${PAD + 4}" r="6" fill="#ffbd2e"/><circle cx="${PAD + 46}" cy="${PAD + 4}" r="6" fill="#27c93f"/>
<clipPath id="screen"><rect x="0" y="${PAD + 24}" width="${W}" height="${ROWS * LH + 4}"/></clipPath>
<g clip-path="url(#screen)"><g id="content">
${texts.join("\n")}
</g></g>
</svg>
`;
}
