// WCAG helpers shared by the auditor and the rules.

/**
 * Tags used for regression detection. A patch is judged against the whole
 * WCAG 2.x A/AA rule set, not only the rules being fixed: a fix that sets
 * alt="" inside a link silences image-alt but breaks link-name, and we want
 * to see that.
 */
export const REGRESSION_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** WCAG success criteria from axe tags such as "wcag111" -> "1.1.1". */
export function wcagFromTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(t);
    if (m) out.push(`${m[1]}.${m[2]}.${m[3]}`);
  }
  return out;
}
