#!/usr/bin/env node
// Entry point of the verifa11y GitHub Action (action.yml runs this).
//
// On a pull request: list the changed files, audit the HTML ones with the
// verifa11y CLI from this repository, run `fix --verify` on each, and post one
// review whose inline comments are suggestions for verified patches only.
// When the token cannot write (fork pull requests), the same report goes to
// the job summary instead. Inputs arrive as VERIFA11Y_ACTION_* variables.

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAVEATS, CONFORMANCE, WARNING, type Finding, type Patch, type VerificationStatus } from "verifa11y-core";
import { rightHunks } from "./diff.js";
import { GitHub, GitHubError } from "./github.js";
import { matchesAny, parsePatterns } from "./glob.js";
import { REVIEW_MARKER, bodyOnlyPayload, planReview, reviewPayload, type ReviewPlan } from "./review.js";
import type { FileReport, FindingResult } from "./suggest.js";

const CLI = fileURLToPath(new URL("../../cli/dist/cli.js", import.meta.url));
const MODES = ["codemod", "auto", "llm"];
const FAIL_ON = ["none", "findings", "unfixed"];

interface PullRequest {
  number: number;
  head: { sha: string; repo: { full_name: string } | null };
  base: { repo: { full_name: string } };
}

interface SummaryRow {
  findingId: string;
  status: VerificationStatus;
  reason: string | null;
  tier: 0 | 1 | null;
}

const env = process.env;
const input = (name: string, fallback = "") => (env[`VERIFA11Y_ACTION_${name}`] ?? "").trim() || fallback;

function bool(name: string, fallback: boolean): boolean {
  const v = input(name).toLowerCase();
  if (v === "") return fallback;
  if (["true", "yes", "1"].includes(v)) return true;
  if (["false", "no", "0"].includes(v)) return false;
  throw new Error(`input ${name.toLowerCase().replace(/_/g, "-")} must be true or false, got ${JSON.stringify(v)}`);
}

function oneOf(name: string, allowed: string[], fallback: string): string {
  const v = input(name, fallback);
  if (!allowed.includes(v)) throw new Error(`input ${name.toLowerCase().replace(/_/g, "-")} must be one of ${allowed.join(", ")}, got ${JSON.stringify(v)}`);
  return v;
}

/** Environment for the CLI: no GitHub token, and no generator other than the one the workflow named. */
function cliEnv(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith("VERIFA11Y_ACTION_") || k === "VERIFA11Y_GENERATOR_CMD" || k === "GITHUB_TOKEN") continue;
    out[k] = v;
  }
  return out;
}

function cli(args: string[], capture = false): { ok: boolean; stdout: string } {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    env: cliEnv(),
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ok: r.status === 0, stdout: r.stdout ?? "" };
}

function git(args: string[]): string | null {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Workflow commands take one line; keep data from becoming a command. */
const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

async function setOutputs(values: Record<string, string | number>): Promise<void> {
  if (!env.GITHUB_OUTPUT) return;
  await appendFile(env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, " ")}\n`).join(""), "utf8");
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function auditOne(file: string, dir: string, o: { mode: string; strict: boolean; generatorCmd: string }): Promise<{ results: FindingResult[]; patch: string } | string> {
  await mkdir(dir, { recursive: true });
  const findingsFile = path.join(dir, "findings.json");
  if (!cli(["audit", file, "--out", findingsFile]).ok) return "the audit failed (see the job log)";
  const findings = await readJson<Finding[]>(findingsFile);
  if (findings.length === 0) return { results: [], patch: "" };

  const fixDir = path.join(dir, "fix");
  const args = ["fix", findingsFile, "--verify", "--mode", o.mode, "--out", fixDir];
  if (o.strict) args.push("--strict");
  if (o.mode !== "codemod") args.push("--generator-cmd", o.generatorCmd);
  if (!cli(args).ok) return "fix --verify failed (see the job log)";

  const summary = await readJson<{ results: SummaryRow[] }>(path.join(fixDir, "summary.json"));
  const byId = new Map(findings.map((f) => [f.id, f]));
  const results: FindingResult[] = [];
  for (const row of summary.results) {
    const finding = byId.get(row.findingId);
    if (!finding) continue;
    const patchFile = path.join(fixDir, `${row.findingId}.patch.json`);
    const patch = existsSync(patchFile) ? await readJson<Patch>(patchFile) : null;
    results.push({ finding, status: row.status, reason: row.reason, tier: row.tier, patch });
  }
  const patchFile = path.join(fixDir, "verifa11y.patch");
  return { results, patch: existsSync(patchFile) ? await readFile(patchFile, "utf8") : "" };
}

async function post(gh: GitHub, pr: PullRequest, plan: ReviewPlan): Promise<{ url: string; note: string | null }> {
  const [reviews, comments] = await Promise.all([gh.listReviews(pr.number), gh.listReviewComments(pr.number)]);
  const posted = new Set(comments.flatMap((c) => Array.from(c.body.matchAll(/<!-- verifa11y:suggestion ([0-9a-f]{16}) -->/g), (m) => m[1]!)));
  const fresh = plan.comments.filter((_, i) => !posted.has(plan.suggestions[i]!.key));
  const last = reviews.filter((r) => r.body?.startsWith(REVIEW_MARKER)).at(-1);
  if (last?.body?.startsWith(`${REVIEW_MARKER} ${plan.digest} -->`) && fresh.length === 0) {
    return { url: last.html_url ?? "", note: "nothing changed since the last verifa11y review; not posting another" };
  }
  const payload = { ...reviewPayload(plan, pr.head.sha), comments: fresh };
  try {
    const r = await gh.createReview(pr.number, payload);
    return { url: r.html_url ?? "", note: null };
  } catch (err) {
    // A comment GitHub will not place (a diff it computed differently): keep the review, inline nothing.
    if (err instanceof GitHubError && err.status === 422 && fresh.length > 0) {
      console.log(`::warning::GitHub refused the inline suggestions (${esc(err.message)}); posting them in the review body instead`);
      const r = await gh.createReview(pr.number, bodyOnlyPayload(plan, pr.head.sha));
      return { url: r.html_url ?? "", note: null };
    }
    throw err;
  }
}

export async function run(): Promise<number> {
  const mode = oneOf("MODE", MODES, "codemod");
  const strict = bool("STRICT", true);
  const failOn = oneOf("FAIL_ON", FAIL_ON, "none");
  const generatorCmd = input("GENERATOR_CMD");
  if (mode !== "codemod" && !generatorCmd) {
    throw new Error(`mode ${mode} needs the generator-cmd input: the action never calls a model the workflow did not name`);
  }
  const patterns = parsePatterns(input("PATHS", "**/*.html\n**/*.htm"));
  const maxFiles = Number(input("MAX_FILES", "50"));
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error("input max-files must be a positive integer");
  const outDir = path.resolve(input("OUT") || path.join(env.RUNNER_TEMP ?? os.tmpdir(), "verifa11y"));

  if (!env.GITHUB_EVENT_PATH || !env.GITHUB_REPOSITORY) throw new Error("not running in GitHub Actions (GITHUB_EVENT_PATH and GITHUB_REPOSITORY are unset)");
  const event = await readJson<{ pull_request?: PullRequest }>(env.GITHUB_EVENT_PATH);
  const pr = event.pull_request;
  if (!pr) {
    console.log(`::notice::verifa11y: ${env.GITHUB_EVENT_NAME ?? "this"} event has no pull request; nothing to review`);
    await setOutputs({ findings: 0, verified: 0, suggested: 0, unfixed: 0, patch: "", results: "", "review-url": "" });
    return 0;
  }
  if (env.GITHUB_EVENT_NAME === "pull_request_target") {
    console.log("::warning::verifa11y: running on pull_request_target. Use pull_request: this action needs no write access to the base repository's secrets.");
  }

  const head = git(["rev-parse", "HEAD"]);
  if (head !== pr.head.sha) {
    throw new Error(
      `the checkout is ${head ?? "not a git repository"}, not the pull request head ${pr.head.sha}. ` +
        "Suggestions must point at the head's lines: use actions/checkout with `ref: ${{ github.event.pull_request.head.sha }}`.",
    );
  }

  const token = input("TOKEN");
  const gh = new GitHub({ token, repo: env.GITHUB_REPOSITORY, apiUrl: env.GITHUB_API_URL });
  // Regular files only: a symlink in the pull request could point outside the checkout.
  const regular = (f: string) => existsSync(f) && lstatSync(f).isFile();
  const changed = (await gh.listFiles(pr.number)).filter((f) => f.status !== "removed" && matchesAny(f.filename, patterns) && regular(f.filename));
  const chosen = changed.slice(0, maxFiles);
  const notAudited = changed.slice(maxFiles).map((f) => f.filename);
  console.log(`verifa11y: ${changed.length} changed file(s) match ${patterns.join(", ")}; auditing ${chosen.length}`);

  const files: FileReport[] = [];
  const patches: string[] = [];
  for (const [i, f] of chosen.entries()) {
    console.log(`::group::${esc(f.filename)}`);
    const src = await readFile(f.filename, "utf8");
    const r = await auditOne(f.filename, path.join(outDir, String(i + 1)), { mode, strict, generatorCmd });
    console.log("::endgroup::");
    const hunks = f.patch ? rightHunks(f.patch) : null;
    if (typeof r === "string") {
      console.log(`::warning file=${esc(f.filename)}::verifa11y: ${esc(r)}`);
      files.push({ path: f.filename, src, hunks, results: [], error: r });
    } else {
      files.push({ path: f.filename, src, hunks, results: r.results });
      if (r.patch) patches.push(r.patch);
    }
  }

  const version = cli(["--version"], true).stdout.trim() || "unknown";
  const plan = planReview(files, { mode, strict, version, generator: mode === "codemod" ? null : generatorCmd, notAudited });

  await mkdir(outDir, { recursive: true });
  const patchPath = path.join(outDir, "verifa11y.patch");
  const resultsPath = path.join(outDir, "results.json");
  await writeFile(patchPath, patches.join(""), "utf8");
  await writeFile(
    resultsPath,
    `${JSON.stringify(
      {
        conformance: CONFORMANCE,
        caveats: [...CAVEATS],
        warning: WARNING,
        version,
        mode,
        strict,
        pullRequest: pr.number,
        commit: pr.head.sha,
        counts: plan.counts,
        files: files.map((f) => ({
          path: f.path,
          error: f.error ?? null,
          results: f.results.map((r) => ({
            findingId: r.finding.id,
            ruleId: r.finding.ruleId,
            line: r.finding.sourceLines?.start ?? null,
            status: r.status,
            reason: r.reason,
            tier: r.tier,
            patch: r.patch,
            suggested: plan.suggestions.some((s) => s.path === f.path && s.fixes.includes(r)),
          })),
        })),
        notAudited,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const fork = pr.head.repo?.full_name !== pr.base.repo.full_name;
  let reviewUrl = "";
  let note: string | null = null;
  if (fork) {
    note = "This pull request comes from a fork, so the workflow token is read-only and no review was posted. The report and every suggestion are below; the verified patch is in the job's verifa11y.patch.";
  } else if (plan.counts.findings === 0 && plan.counts.errors === 0) {
    note = "No findings, so no review was posted.";
  } else if (!token) {
    note = "No github-token, so no review was posted.";
  } else {
    try {
      const r = await post(gh, pr, plan);
      reviewUrl = r.url;
      note = r.note;
    } catch (err) {
      if (err instanceof GitHubError && (err.status === 403 || err.status === 404)) {
        note = `The token could not post a review (${err.status}; the workflow needs \`pull-requests: write\`). The report is below.`;
        console.log(`::warning::verifa11y: ${esc(err.message)}`);
      } else {
        throw err;
      }
    }
  }
  if (note) console.log(`verifa11y: ${note}`);
  if (reviewUrl) console.log(`verifa11y: review ${reviewUrl}`);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `${note ? `> [!NOTE]\n> ${note}\n\n` : ""}${plan.summary}\n`, "utf8");

  const c = plan.counts;
  await setOutputs({
    findings: c.findings,
    verified: c.verified,
    suggested: c.suggested,
    suspicious: c.suspicious,
    skipped: c.skipped,
    unfixed: c.unfixed,
    patch: patchPath,
    results: resultsPath,
    "review-url": reviewUrl,
  });
  console.log(`verifa11y: ${c.findings} finding(s), ${c.verified} verified (${c.suggested} suggested inline), ${c.suspicious} suspicious, ${c.rejected} rejected, ${c.skipped} skipped. ${CONFORMANCE}.`);

  if (failOn === "findings" && (c.findings > 0 || c.errors > 0)) {
    console.log(`::error::verifa11y: ${c.findings} finding(s)${c.errors ? ` and ${c.errors} file(s) not audited` : ""} (fail-on: findings)`);
    return 1;
  }
  if (failOn === "unfixed" && c.unfixed > 0) {
    console.log(`::error::verifa11y: ${c.unfixed} finding(s) or file(s) without a verified fix (fail-on: unfixed)`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: Error) => {
      console.log(`::error::verifa11y: ${esc(err.message)}`);
      process.exitCode = 1;
    });
}
