// robots.txt (RFC 9309): groups by user agent, Allow/Disallow with the
// longest match winning, `*` and `$` wildcards, plus the Sitemap and
// Crawl-delay extensions. a11yfix matches the product token "a11yfix" and
// falls back to the "*" group.

export interface Robots {
  allowed(url: string): boolean;
  /** Seconds, from the matched group; null when absent. */
  crawlDelay: number | null;
  sitemaps: string[];
}

interface RuleLine {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: RuleLine[];
  crawlDelay: number | null;
}

export const ALLOW_ALL: Robots = { allowed: () => true, crawlDelay: null, sitemaps: [] };

export function parseRobots(text: string, agent = "a11yfix"): Robots {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow allows everything: no rule.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const token = agent.toLowerCase();
  const specific = groups.filter((g) => g.agents.includes(token));
  const matched = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = matched.flatMap((g) => g.rules);
  const crawlDelay = matched.map((g) => g.crawlDelay).find((d) => d !== null) ?? null;

  return {
    crawlDelay,
    sitemaps,
    allowed(url: string): boolean {
      let target: string;
      try {
        const u = new URL(url);
        target = decodeSafe(u.pathname) + u.search;
      } catch {
        return false;
      }
      if (target === "/robots.txt") return true;
      let best: RuleLine | null = null;
      let bestLen = -1;
      for (const r of rules) {
        if (!matches(r.pattern, target)) continue;
        const len = r.pattern.length;
        // Longest match wins; on a tie, Allow wins (least restrictive).
        if (len > bestLen || (len === bestLen && r.allow)) {
          best = r;
          bestLen = len;
        }
      }
      return best ? best.allow : true;
    },
  };
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function matches(pattern: string, target: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = decodeSafe(anchored ? pattern.slice(0, -1) : pattern);
  const re = new RegExp(`^${body.split("*").map(escapeRe).join(".*")}${anchored ? "$" : ""}`);
  return re.test(target);
}

function escapeRe(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}
