// Orchestration shared by `fix` and `bench`: generate a patch per finding,
// validate it, verify it against a re-audit, and write everything to disk.
//
// Every patch is generated and verified independently against the original
// file. Verified patches are then combined into one patched page (applied
// back to front, skipping overlaps) and that page is audited once more, so
// the report can say how many violations are actually left.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditSource, type AuditResult } from "./audit.js";
import type { Generator } from "./generate.js";
import { validatePatch } from "./validate.js";
import { verifyPatch } from "./verify.js";
import { ZERO_USAGE, addUsage, type Finding, type GenerationResult, type Patch, type Usage, type Verification } from "./types.js";

export interface PatchOutcome {
  finding: Finding;
  generation: GenerationResult;
  /** Final status. Generation failures are reported as rejected_invalid. */
  verification: Verification;
  /** False when --verify is off: status then reflects shape validation only. */
  verified: boolean;
  editStart: number | null;
  editEndOld: number | null;
  after: string | null;
}

export interface PageOutcome {
  file: string;
  findings: Finding[];
  outcomes: PatchOutcome[];
  usage: Usage;
  ms: number;
  /** Subset violations left after applying every verified patch together. */
  remaining: Finding[] | null;
  /** WCAG A/AA violations (any rule) before and after combining. */
  allBefore: number;
  allAfter: number | null;
  combined: string | null;
  combinedSkipped: string[];
}

/** Minimal concurrency limiter. */
export function limiter(n: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= n) return;
    const job = queue.shift();
    if (job) {
      active++;
      job();
    }
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
}

export interface ProcessOptions {
  generator: Generator;
  verify: boolean;
  limit?: number;
  /** Concurrent generator calls. */
  genLimit: ReturnType<typeof limiter>;
  /** Concurrent browser audits. */
  auditLimit: ReturnType<typeof limiter>;
  log?: (msg: string) => void;
}

/** Process every finding of one page. `findings` must all belong to `file`. */
export async function processPage(
  file: string,
  findings: Finding[],
  opts: ProcessOptions,
  baseline?: AuditResult,
): Promise<PageOutcome> {
  const started = Date.now();
  const src = await readFile(file, "utf8");
  const selected = opts.limit !== undefined ? findings.slice(0, opts.limit) : findings;
  const log = opts.log ?? (() => {});

  const base = opts.verify ? (baseline ?? (await opts.auditLimit(() => auditSource(file, src)))) : null;

  const one = async (f: Finding): Promise<PatchOutcome> => {
    const generation = await opts.genLimit(() => opts.generator.generate(f, src));
    if (!generation.patch) {
      log(`  ${f.id} ${f.ruleId}: generation failed (${generation.error})`);
      return {
        finding: f,
        generation,
        verified: opts.verify,
        verification: {
          findingId: f.id,
          status: "rejected_invalid",
          ruleGone: false,
          newViolations: [],
          suspicious: false,
          reason: `generation failed: ${generation.error}`,
        },
        editStart: null,
        editEndOld: null,
        after: null,
      };
    }
    const shape = validatePatch(src, f, generation.patch);
    const edit = shape.ok
      ? {
          editStart: shape.applied.editStart,
          editEndOld: shape.applied.editEndOld,
          after: shape.applied.patched.slice(shape.applied.editStart, shape.applied.editEndNew),
        }
      : { editStart: null, editEndOld: null, after: null };

    let verification: Verification;
    if (!opts.verify || !shape.ok) {
      verification = {
        findingId: f.id,
        status: shape.ok ? "verified" : shape.status,
        ruleGone: false,
        newViolations: [],
        suspicious: false,
        reason: shape.ok ? "shape-valid; not verified (--verify off)" : shape.reason,
        diff: shape.ok ? shape.applied.diff : undefined,
      };
    } else {
      const out = await opts.auditLimit(() => verifyPatch({ file, src, finding: f, patch: generation.patch, baseline: base! }));
      verification = out.verification;
    }
    log(`  ${f.id} ${f.ruleId}: ${verification.status}${verification.reason ? ` (${verification.reason})` : ""}`);
    return { finding: f, generation, verification, verified: opts.verify, ...edit };
  };

  // Warm the prompt cache with one request before fanning out, so the
  // remaining requests for this page read the cached file instead of all
  // writing it at once.
  const outcomes: PatchOutcome[] = [];
  if (selected.length > 0) outcomes.push(await one(selected[0]!));
  outcomes.push(...(await Promise.all(selected.slice(1).map(one))));

  const usage = outcomes.reduce((u, o) => addUsage(u, o.generation.usage), ZERO_USAGE);

  // Combine verified patches and audit the result once.
  let remaining: Finding[] | null = null;
  let allAfter: number | null = null;
  let combined: string | null = null;
  let combinedSkipped: string[] = [];
  if (opts.verify) {
    const accepted = outcomes.filter((o) => o.verification.status === "verified");
    const c = combine(src, accepted);
    combined = c.text;
    combinedSkipped = c.skipped;
    const after = await opts.auditLimit(() => auditSource(file, c.text));
    remaining = after.findings;
    allAfter = after.all.length;
  }

  return {
    file,
    findings: selected,
    outcomes,
    usage,
    ms: Date.now() - started,
    remaining,
    allBefore: base?.all.length ?? 0,
    allAfter,
    combined,
    combinedSkipped,
  };
}

/** Apply non-overlapping patches back to front, in original-file coordinates. */
export function combine(src: string, accepted: PatchOutcome[]): { text: string; skipped: string[] } {
  const edits = accepted
    .filter((o) => o.editStart !== null && o.editEndOld !== null && o.after !== null)
    .sort((a, b) => b.editStart! - a.editStart!);
  let text = src;
  let floor = Number.POSITIVE_INFINITY;
  const skipped: string[] = [];
  for (const e of edits) {
    if (e.editEndOld! > floor) {
      skipped.push(e.finding.id);
      continue;
    }
    text = text.slice(0, e.editStart!) + e.after! + text.slice(e.editEndOld!);
    floor = e.editStart!;
  }
  return { text, skipped };
}

/* ---------------------------------------------------------------------- */

export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Write per-patch artifacts for one page into `dir`. */
export async function writePageArtifacts(dir: string, page: PageOutcome): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const o of page.outcomes) {
    const id = o.finding.id;
    if (o.generation.patch) await writeJson(path.join(dir, `${id}.patch.json`), o.generation.patch satisfies Patch);
    const { diff, ...verification } = o.verification;
    await writeJson(path.join(dir, `${id}.verification.json`), verification);
    if (diff) await writeFile(path.join(dir, `${id}.diff`), diff, "utf8");
  }
  const accepted = page.outcomes.filter((o) => o.verification.status === "verified" && o.verification.diff);
  await writeFile(path.join(dir, "accepted.diff"), accepted.map((o) => o.verification.diff).join("\n"), "utf8");
  if (page.combined !== null) await writeFile(path.join(dir, `patched-${path.basename(page.file)}`), page.combined, "utf8");
  await writeJson(path.join(dir, "summary.json"), {
    file: page.file,
    findings: page.findings.length,
    statuses: countBy(page.outcomes.map((o) => o.verification.status)),
    remainingSubsetViolations: page.remaining?.length ?? null,
    wcagViolationsBefore: page.allBefore,
    wcagViolationsAfter: page.allAfter,
    combinedSkipped: page.combinedSkipped,
    usage: page.usage,
    ms: page.ms,
    results: page.outcomes.map((o) => ({
      findingId: o.finding.id,
      ruleId: o.finding.ruleId,
      line: o.finding.sourceLines?.start ?? null,
      status: o.verification.status,
      reason: o.verification.reason,
      confidence: o.generation.patch?.confidence ?? null,
      attempts: o.generation.attempts,
      usage: o.generation.usage,
    })),
  });
}

export function countBy(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}
