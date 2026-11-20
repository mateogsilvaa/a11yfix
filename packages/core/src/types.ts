// Shared data model. These shapes are what ends up on disk as findings.json,
// patch.json and verification.json, so changes here are format changes.

export type Impact = "minor" | "moderate" | "serious" | "critical";

export interface SourceLocation {
  /** 1-based, inclusive. */
  start: number;
  end: number;
}

export interface SourceRange {
  /** Character offsets into the source file, [start, end). */
  start: number;
  end: number;
}

/** One axe check result attached to a node (any/all/none), trimmed. */
export interface CheckResult {
  id: string;
  message: string;
  data: unknown;
}

/** Context gathered in the browser at audit time, used to build the prompt. */
export interface NodeContext {
  tagName: string;
  attributes: Record<string, string>;
  /** Visible text of the element, trimmed and truncated. */
  text: string;
  /** Text of the nearest meaningful surroundings (caption, parent text, link text). */
  nearbyText: string;
  /** Selected computed styles: color, background, font size/weight. */
  computedStyle: Record<string, string>;
  /** Page heading outline, in document order. Only filled for heading rules. */
  headingOutline?: Array<{ level: number; text: string; isTarget: boolean }>;
}

export interface Finding {
  id: string;
  ruleId: string;
  wcag: string[];
  impact: Impact | null;
  selector: string;
  /** Index of this node within the rule's node list in the axe result. */
  nodeIndex: number;
  /** DOM-serialized outerHTML (what the browser built), truncated. */
  outerHTML: string;
  /** Exact text of the element in the source file, if it could be mapped. */
  sourceSnippet: string | null;
  ancestorChain: string[];
  sourceFile: string;
  sourceLines: SourceLocation | null;
  sourceRange: SourceRange | null;
  help: string;
  description: string;
  helpUrl: string;
  failureSummary: string;
  checks: CheckResult[];
  context: NodeContext;
}

export type Confidence = "high" | "medium" | "low";

export interface Patch {
  findingId: string;
  rationale: string;
  before: string;
  after: string;
  confidence: Confidence;
}

export type VerificationStatus =
  | "verified"
  | "rejected_persists"
  | "rejected_regression"
  | "rejected_suspicious"
  | "rejected_invalid"
  | "rejected_apply_failed"
  /** No patch was attempted: the tier-0 codemod declined and no tier-1 generator is configured. */
  | "skipped";

export interface ViolationRef {
  ruleId: string;
  impact?: Impact | null;
  selector: string;
  sourceLines: SourceLocation | null;
}

/** static: source checks (hiding, generic text...); rule: the rule's own verify(); the rest: browser comparisons. */
export type SuspicionLayer = "static" | "rule" | "accessibility-tree" | "focus-order" | "visual";

export interface Verification {
  findingId: string;
  status: VerificationStatus;
  ruleGone: boolean;
  newViolations: ViolationRef[];
  suspicious: boolean;
  reason: string | null;
  /** Unified diff of the patch against the original file (empty when not applied). */
  diff?: string;
  /** New violations below the regression threshold (--regression-impact): reported, not rejected. */
  toleratedViolations?: ViolationRef[];
  /**
   * Which verifier layers raised a suspicion reason (empty or absent when none did). Recorded even when the patch
   * was rejected for another reason first, so the benchmark can measure what each layer adds over axe alone.
   */
  flaggedBy?: SuspicionLayer[];
  /** Accessibility-tree, focus-order and visual comparison, when they ran. */
  checks?: {
    ax?: string[];
    focus?: { before: number; after: number; lost: string[]; added: string[]; reordered: boolean };
    visual?: Array<{ viewport: string; changeOutside: number; changedPixelsOutside: number; size: [number, number, number, number]; layoutShift: number }>;
  };
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/** Result of asking a generator for a patch. `patch` is null when generation failed. */
export interface GenerationResult {
  patch: Patch | null;
  /** 0 = deterministic codemod, 1 = LLM. */
  tier: 0 | 1;
  /** Raw failure reason when patch is null (invalid JSON after retries, refusal, ...). */
  error: string | null;
  attempts: number;
  usage: Usage;
  ms: number;
}
