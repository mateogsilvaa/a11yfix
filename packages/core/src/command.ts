// Tier 1 through any command: a coding agent's CLI, a local model runner, or
// a script of your own. verifa11y does not care who writes the patch, only
// whether the verifier accepts it.
//
// Protocol: the command runs once per attempt through the shell. It receives
// the request on stdin and must print a patch object on stdout:
//   {"findingId": "...", "rationale": "...", "before": "...", "after": "...", "confidence": "high|medium|low"}
// Text around the object (markdown fences, prose) is tolerated: the first
// JSON object that matches the schema wins. Anything else is an invalid
// attempt, retried at most `maxRetries` times with the error appended.
//
// Input formats:
//   text  one plain-text prompt (system instructions, the numbered source
//         file, the finding). Works with `claude -p`, `codex exec -`,
//         `ollama run <model>`, `llm`, and most agent CLIs.
//   json  {system, file, sourceFile, prompt, finding, schema} for scripts
//         that build their own request.
//
// The command sees the full source of the page being fixed. Point it only at
// a model or service you are allowed to send that page to.

import { spawn } from "node:child_process";
import { buildFindingPrompt, SYSTEM_PROMPT, type Generator } from "./llm.js";
import type { Rule } from "./rule.js";
import { withLineNumbers } from "./source.js";
import { ZERO_USAGE, type Finding, type GenerationResult, type Patch } from "./types.js";
import { PATCH_JSON_SCHEMA, parsePatch } from "./validate.js";

export type CommandInput = "text" | "json";

export interface CommandOptions {
  command: string;
  input?: CommandInput;
  /** Per attempt. Agents can be slow; the default is generous. */
  timeoutMs?: number;
  maxRetries?: number;
  cwd?: string;
}

export class CommandGenerator implements Generator {
  readonly name: string;
  readonly command: string;
  private input: CommandInput;
  private timeoutMs: number;
  private maxRetries: number;
  private cwd: string | undefined;

  constructor(opts: CommandOptions) {
    if (!opts.command.trim()) throw new Error("generator command is empty");
    this.command = opts.command;
    this.input = opts.input ?? "text";
    this.timeoutMs = opts.timeoutMs ?? 300_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.cwd = opts.cwd;
    this.name = `cmd:${this.command}`;
  }

  async generate(finding: Finding, src: string, rule?: Rule): Promise<GenerationResult> {
    const started = Date.now();
    const done = (patch: Patch | null, error: string | null, attempts: number): GenerationResult => ({
      patch,
      error,
      attempts,
      // Token usage is unknown: the command may be anything.
      usage: ZERO_USAGE,
      ms: Date.now() - started,
      tier: 1,
    });

    const prompt = buildFindingPrompt(finding, rule);
    const fileBlock = `Source file ${finding.sourceFile}, with line numbers (the "NNN | " prefixes are not part of the file):\n\n${withLineNumbers(src)}`;
    const attempts = this.maxRetries + 1;
    let feedback = "";
    let lastError = "no attempt made";

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const request =
        this.input === "json"
          ? JSON.stringify({
              system: SYSTEM_PROMPT,
              file: src,
              sourceFile: finding.sourceFile,
              prompt: prompt + feedback,
              finding,
              schema: PATCH_JSON_SCHEMA,
            })
          : `${SYSTEM_PROMPT}\n\n${fileBlock}\n\n${prompt}${feedback}\n`;

      let out: RunResult;
      try {
        out = await run(this.command, request, this.timeoutMs, this.cwd);
      } catch (err) {
        // The command could not start at all (not found, permission): every
        // finding would fail the same way, so stop the run.
        throw new Error(`generator command failed to start: ${(err as Error).message}`);
      }
      if (out.timedOut) {
        lastError = `timed out after ${Math.round(this.timeoutMs / 1000)} s`;
      } else if (out.code !== 0 && !out.stdout.trim()) {
        lastError = `exited with code ${out.code}${out.stderr.trim() ? `: ${tail(out.stderr)}` : ""}`;
        if (out.code === 127 || /not (found|recognized)/i.test(out.stderr)) {
          throw new Error(`generator command not found: ${this.command}\n${tail(out.stderr)}`);
        }
      } else {
        const found = extractPatch(out.stdout);
        if (found.ok) return done(found.patch, null, attempt);
        // Say what came back: a CLI that is not signed in often prints its
        // error on stdout and exits 0.
        lastError = `${found.reason}; output began: ${JSON.stringify(out.stdout.trim().slice(0, 160))}`;
      }
      feedback = `\n\nYour previous response was not valid: ${lastError}. Reply again with only the JSON object (findingId, rationale, before, after, confidence).`;
    }
    return done(null, `invalid output after ${attempts} attempts: ${lastError}`, attempts);
  }
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function run(command: string, stdin: string, timeoutMs: number, cwd?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    // A command that does not read stdin closes the pipe early: ignore EPIPE.
    child.stdin.on("error", () => {});
    child.stdin.end(stdin, "utf8");
  });
}

function tail(s: string, n = 400): string {
  const t = s.trim();
  return t.length <= n ? t : `…${t.slice(-n)}`;
}

/**
 * Find the patch object in free-form output: the whole output, then every
 * balanced {...} candidate in order. The first one that matches the schema
 * wins; otherwise the most informative error is returned.
 */
export function extractPatch(output: string): { ok: true; patch: Patch } | { ok: false; reason: string } {
  const text = output.trim();
  if (!text) return { ok: false, reason: "empty output" };
  let schemaError: string | null = null;
  for (const candidate of [text, ...jsonObjects(text)]) {
    let raw: unknown;
    try {
      raw = JSON.parse(candidate);
    } catch {
      continue;
    }
    const p = parsePatch(raw);
    if (p.ok) return p;
    schemaError ??= p.reason;
  }
  return { ok: false, reason: schemaError ?? "no JSON object in the output" };
}

/** Balanced top-level {...} substrings, skipping braces inside JSON strings. */
function jsonObjects(text: string): string[] {
  const out: string[] = [];
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === "\\") i++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        out.push(text.slice(start, i + 1));
        break;
      }
    }
  }
  return out;
}
