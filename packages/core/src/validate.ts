// Shape validator. Runs before anything touches a browser. A patch is
// discarded here (rejected_invalid) when:
//   - it does not match the JSON schema,
//   - it targets a different finding,
//   - `after` is empty or identical to `before`,
//   - `before` is not an exact substring of the source file (anti-hallucination),
//   - the resulting diff touches more than MAX_LINES lines or MAX_HUNKS hunks.
// A `before` that matches several places, none clearly at the target node,
// is rejected_apply_failed: the patch may be fine, but we cannot tell where
// it goes.

import { z } from "zod";
import { applyAt, locate, type AppliedPatch } from "./apply.js";
import type { Finding, Patch, VerificationStatus } from "./types.js";

export const MAX_LINES = 6;
export const MAX_HUNKS = 2;

export const PatchSchema = z
  .object({
    findingId: z.string().min(1),
    rationale: z.string().min(1),
    before: z.string(),
    after: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict();

/** JSON Schema sent to the model as the structured output format. */
export const PATCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    findingId: { type: "string" },
    rationale: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["findingId", "rationale", "before", "after", "confidence"],
  additionalProperties: false,
} as const;

export type ValidationResult =
  | { ok: true; patch: Patch; applied: AppliedPatch }
  | { ok: false; status: Extract<VerificationStatus, "rejected_invalid" | "rejected_apply_failed">; reason: string };

export function parsePatch(raw: unknown): { ok: true; patch: Patch } | { ok: false; reason: string } {
  const r = PatchSchema.safeParse(raw);
  if (!r.success) {
    return { ok: false, reason: `schema: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}` };
  }
  return { ok: true, patch: r.data };
}

export function validatePatch(src: string, finding: Finding, raw: unknown): ValidationResult {
  const parsed = parsePatch(raw);
  if (!parsed.ok) return { ok: false, status: "rejected_invalid", reason: parsed.reason };
  const patch = parsed.patch;

  if (patch.findingId !== finding.id) {
    return { ok: false, status: "rejected_invalid", reason: `findingId ${patch.findingId} does not match ${finding.id}` };
  }
  if (patch.after.trim() === "") return { ok: false, status: "rejected_invalid", reason: "`after` is empty" };
  if (patch.before === "") return { ok: false, status: "rejected_invalid", reason: "`before` is empty" };
  if (patch.before === patch.after) {
    return { ok: false, status: "rejected_invalid", reason: "`after` is identical to `before`" };
  }

  const loc = locate(src, patch, finding.sourceRange);
  if (!loc.ok) {
    return {
      ok: false,
      status: loc.kind === "not_found" ? "rejected_invalid" : "rejected_apply_failed",
      reason: loc.reason,
    };
  }

  const fileName = finding.sourceFile.split("/").pop() ?? "file.html";
  const applied = applyAt(src, loc.index, loc.before, loc.after, fileName);
  if (applied.hunks > MAX_HUNKS) {
    return { ok: false, status: "rejected_invalid", reason: `diff has ${applied.hunks} hunks (max ${MAX_HUNKS})` };
  }
  if (applied.linesTouched > MAX_LINES) {
    return {
      ok: false,
      status: "rejected_invalid",
      reason: `diff touches ${applied.linesTouched} lines (max ${MAX_LINES})`,
    };
  }
  return { ok: true, patch, applied };
}
