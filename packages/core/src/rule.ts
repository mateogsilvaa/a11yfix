// The Rule plugin API.
//
// STATUS: experimental (0.x). The shape below is what a11yfix-rules-core is
// written against, and it is versioned, but it is not yet open to third-party
// rule packages: per ADR 0006 the API opens only after the verifier covers the
// accessibility tree and visual regressions (roadmap phase 3). Until then,
// breaking changes are allowed in minor versions and are listed in CHANGELOG.
//
// Contract highlights:
//   - Detection is backed by an axe-core rule (`axe`), optionally narrowed by
//     `detect`.
//   - `fix` is the tier-0 deterministic codemod. It must be pure and
//     reproducible, and it must DECLINE (return null) whenever the right fix
//     needs judgment. Declined findings go to tier 1 (the LLM), or are reported
//     as skipped when no model is configured. Tier 0 is held to 100% precision.
//   - `verify` can only ADD suspicion reasons. The core verifier's checks
//     (re-audit, regression over all WCAG A/AA rules, hiding, deleting,
//     generic text...) always run and cannot be turned off by a rule.

import type { ParsedSource, Element } from "./source.js";
import type { AppliedPatch } from "./apply.js";
import type { Confidence, Finding, SourceRange } from "./types.js";

/** 0 = deterministic codemod, 1 = needs judgment (LLM). */
export type Tier = 0 | 1;

export interface FixContext {
  finding: Finding;
  /** Full source of the file. */
  src: string;
  parsed: ParsedSource;
  /** parse5 element of the target node, when the finding maps to the source. */
  element: Element | null;
  /** Exact source text of the element's start tag, and its range. */
  startTag: string | null;
  startTagRange: SourceRange | null;
  /** Every id attribute value in the document. */
  ids: Set<string>;
}

/** A proposed edit: replace `before` (an exact substring of the source) with `after`. */
export interface CodemodResult {
  before: string;
  after: string;
  rationale: string;
  confidence?: Confidence;
}

export interface RuleVerifyContext {
  finding: Finding;
  src: string;
  applied: AppliedPatch;
  oldElements: Element[];
  newElements: Element[];
}

export interface RuleDeprecation {
  /** Rule package version that deprecated the rule. */
  since: string;
  replacedBy?: string;
  reason: string;
}

export interface Rule {
  /** Stable public id. Never reused for a different meaning (see docs/rule-versioning.md). */
  id: string;
  /** Semver of this rule's behavior (detection scope + fix + extra verification). */
  version: string;
  /** axe-core rule id that detects violations for this rule. */
  axe: string;
  wcag: string[];
  /** 1 = structural, 2 = harder fixes (contrast). Used by `audit --level`. */
  level: 1 | 2;
  /** The tier the rule is designed for. A tier-0 rule may still decline single findings. */
  tier: Tier;
  /** Expected confidence of the rule's fixes. */
  confidence: Confidence;
  description: string;
  /**
   * What the rule leaves alone by design: cases its codemod declines (tier 0)
   * or why it has no codemod (tier 1). Shown to agents and in reports so that
   * "skipped" is an expected outcome, not a surprise.
   */
  declines?: string[];
  /** Narrow axe's findings (return false to ignore a node). */
  detect?(finding: Finding): boolean;
  /** Tier-0 codemod. Return null to decline. */
  fix?(ctx: FixContext): CodemodResult | null;
  /** Guidance appended to the tier-1 (LLM) prompt. */
  guidance: string;
  /** Extra, rule-specific suspicion checks. Can only add reasons. */
  verify?(ctx: RuleVerifyContext): string[];
  deprecated?: RuleDeprecation;
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Validate a rule definition at registration time. */
export function defineRule(rule: Rule): Rule {
  const problems: string[] = [];
  if (!ID_RE.test(rule.id)) problems.push(`id "${rule.id}" must be kebab-case`);
  if (!SEMVER_RE.test(rule.version)) problems.push(`version "${rule.version}" is not semver`);
  if (!rule.axe) problems.push("axe rule id is required");
  if (rule.tier !== 0 && rule.tier !== 1) problems.push("tier must be 0 or 1");
  if (rule.tier === 0 && !rule.fix) problems.push("a tier-0 rule must provide fix()");
  if (!rule.guidance) problems.push("guidance is required (it is the tier-1 fallback prompt)");
  if (problems.length) throw new Error(`invalid rule ${rule.id}: ${problems.join("; ")}`);
  return Object.freeze({ ...rule });
}

export class RuleRegistry {
  private byId = new Map<string, Rule>();

  constructor(rules: Rule[] = []) {
    this.register(...rules);
  }

  register(...rules: Rule[]): this {
    for (const r of rules) {
      const rule = defineRule(r);
      if (this.byId.has(rule.id)) throw new Error(`duplicate rule id ${rule.id}`);
      for (const other of this.byId.values()) {
        if (other.axe === rule.axe) throw new Error(`rules ${other.id} and ${rule.id} both claim axe rule ${rule.axe}`);
      }
      this.byId.set(rule.id, rule);
    }
    return this;
  }

  all(): Rule[] {
    return [...this.byId.values()];
  }

  get(id: string): Rule | undefined {
    return this.byId.get(id);
  }

  /** The rule that owns a finding (findings carry the axe rule id). */
  forFinding(f: Finding): Rule | undefined {
    for (const r of this.byId.values()) if (r.axe === f.ruleId) return r;
    return undefined;
  }

  /** axe rule ids for audits, optionally limited by level, skipping deprecated rules. */
  axeIds(level: 1 | 2 = 2): string[] {
    return this.all()
      .filter((r) => r.level <= level && !r.deprecated)
      .map((r) => r.axe);
  }
}
