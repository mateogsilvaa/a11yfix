// Local SQLite storage: sites, runs, pages, findings, patches and
// verifications. Optional (pass --db): verifa11y works without it, but
// incremental site runs need somewhere to remember what was audited.
//
// Uses node:sqlite (built into Node >= 22.13, no native add-on to compile).
// It is loaded lazily so that Node 20 can still run everything else.

import type { PageOutcome } from "../pipeline.js";
import type { Finding } from "../types.js";
import type { SiteFinding, SitePage } from "./crawl.js";

// Minimal structural types for node:sqlite, so this module type-checks the
// same on every @types/node version.
interface Statement {
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}
interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  origin TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,              -- site | fix | bench
  site_id INTEGER REFERENCES sites(id),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  engine TEXT NOT NULL,            -- JSON: engine versions
  options TEXT NOT NULL,           -- JSON
  stats TEXT                       -- JSON
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  last_run_id INTEGER NOT NULL REFERENCES runs(id),
  status TEXT NOT NULL,
  reason TEXT,
  final_url TEXT,
  http_status INTEGER,
  raw_hash TEXT,
  dom_hash TEXT,
  duplicate_of TEXT,
  engine_key TEXT,
  links TEXT NOT NULL,             -- JSON array
  viewports TEXT NOT NULL,         -- JSON array
  wcag_violations INTEGER NOT NULL,
  audited_at TEXT NOT NULL,
  UNIQUE (site_id, url)
);
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id),
  page_id INTEGER REFERENCES pages(id),
  file TEXT,                       -- file mode: source file
  finding_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  impact TEXT,
  selector TEXT NOT NULL,
  fingerprint TEXT,
  viewports TEXT,                  -- JSON array
  screenshot TEXT,
  data TEXT NOT NULL               -- JSON: the full finding
);
CREATE INDEX IF NOT EXISTS findings_page ON findings(page_id, run_id);
CREATE TABLE IF NOT EXISTS patches (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id),
  file TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  before_text TEXT NOT NULL,
  after_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id),
  patch_id INTEGER REFERENCES patches(id),
  file TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  rule_gone INTEGER NOT NULL,
  suspicious INTEGER NOT NULL,
  included INTEGER NOT NULL,
  new_violations TEXT NOT NULL     -- JSON
);
`;

export const SCHEMA_VERSION = "1";

export interface PreviousPage {
  status: SitePage["status"];
  rawHash: string | null;
  domHash: string | null;
  engineKey: string | null;
  finalUrl: string | null;
  httpStatus: number | null;
  links: string[];
  viewports: string[];
  wcagViolations: number;
  findings: SiteFinding[];
}

export class Store {
  private constructor(private db: Database) {}

  static async open(file: string): Promise<Store> {
    let mod: { DatabaseSync: new (path: string) => Database };
    try {
      mod = (await import("node:sqlite")) as unknown as typeof mod;
    } catch {
      throw new Error(
        `--db needs node:sqlite, which this Node.js (${process.versions.node}) does not provide. Use Node 22.13 or later.`,
      );
    }
    const db = new mod.DatabaseSync(file);
    db.exec(SCHEMA);
    const v = db.prepare("SELECT value FROM meta WHERE key = 'schema'").get();
    if (!v) db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?)").run(SCHEMA_VERSION);
    else if (v.value !== SCHEMA_VERSION) throw new Error(`${file}: schema version ${String(v.value)}, expected ${SCHEMA_VERSION}`);
    return new Store(db);
  }

  close(): void {
    this.db.close();
  }

  siteId(origin: string): number {
    const row = this.db.prepare("SELECT id FROM sites WHERE origin = ?").get(origin);
    if (row) return Number(row.id);
    return Number(this.db.prepare("INSERT INTO sites (origin, created_at) VALUES (?, ?)").run(origin, now()).lastInsertRowid);
  }

  beginRun(kind: "site" | "fix" | "bench", siteId: number | null, engine: unknown, options: unknown): number {
    return Number(
      this.db
        .prepare("INSERT INTO runs (kind, site_id, started_at, engine, options) VALUES (?, ?, ?, ?, ?)")
        .run(kind, siteId, now(), JSON.stringify(engine), JSON.stringify(options)).lastInsertRowid,
    );
  }

  finishRun(runId: number, stats: unknown): void {
    this.db.prepare("UPDATE runs SET finished_at = ?, stats = ? WHERE id = ?").run(now(), JSON.stringify(stats), runId);
  }

  /** The latest stored state of a page, with the findings of the run that last audited it. */
  previousPage(siteId: number, url: string): PreviousPage | null {
    const row = this.db.prepare("SELECT * FROM pages WHERE site_id = ? AND url = ?").get(siteId, url);
    if (!row) return null;
    const findings = this.db
      .prepare("SELECT data, viewports, screenshot, fingerprint FROM findings WHERE page_id = ? AND run_id = ? ORDER BY id")
      .all(row.id, row.last_run_id)
      .map((f) => ({
        ...(JSON.parse(String(f.data)) as Finding),
        viewports: JSON.parse(String(f.viewports ?? "[]")) as string[],
        screenshot: (f.screenshot as string | null) ?? null,
        fingerprint: String(f.fingerprint ?? ""),
      }));
    return {
      status: row.status as SitePage["status"],
      rawHash: (row.raw_hash as string | null) ?? null,
      domHash: (row.dom_hash as string | null) ?? null,
      engineKey: (row.engine_key as string | null) ?? null,
      finalUrl: (row.final_url as string | null) ?? null,
      httpStatus: row.http_status === null ? null : Number(row.http_status),
      links: JSON.parse(String(row.links)) as string[],
      viewports: JSON.parse(String(row.viewports)) as string[],
      wcagViolations: Number(row.wcag_violations),
      findings,
    };
  }

  /**
   * Record a page for this run. Reused pages keep pointing at the findings of
   * the run that actually audited them, so nothing is copied.
   */
  savePage(runId: number, siteId: number, page: SitePage, engineKey: string): void {
    const existing = this.db.prepare("SELECT id, last_run_id FROM pages WHERE site_id = ? AND url = ?").get(siteId, page.url);
    if (page.status === "reused" && existing) return; // unchanged: keep the audited state
    const values = [
      runId,
      page.status,
      page.reason ?? null,
      page.finalUrl,
      page.httpStatus,
      page.rawHash,
      page.domHash,
      page.duplicateOf ?? null,
      page.status === "audited" ? engineKey : null,
      JSON.stringify(page.links),
      JSON.stringify(page.viewports),
      page.wcagViolations,
      now(),
    ];
    let pageId: number;
    if (existing) {
      pageId = Number(existing.id);
      this.db
        .prepare(
          `UPDATE pages SET last_run_id = ?, status = ?, reason = ?, final_url = ?, http_status = ?, raw_hash = ?, dom_hash = ?,
           duplicate_of = ?, engine_key = ?, links = ?, viewports = ?, wcag_violations = ?, audited_at = ? WHERE id = ?`,
        )
        .run(...values, pageId);
    } else {
      pageId = Number(
        this.db
          .prepare(
            `INSERT INTO pages (last_run_id, status, reason, final_url, http_status, raw_hash, dom_hash, duplicate_of, engine_key,
             links, viewports, wcag_violations, audited_at, site_id, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(...values, siteId, page.url).lastInsertRowid,
      );
    }
    const ins = this.db.prepare(
      `INSERT INTO findings (run_id, page_id, finding_id, rule_id, impact, selector, fingerprint, viewports, screenshot, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const f of page.findings) {
      const { viewports, screenshot, fingerprint, ...finding } = f;
      ins.run(runId, pageId, f.id, f.ruleId, f.impact, f.selector, fingerprint, JSON.stringify(viewports), screenshot, JSON.stringify(finding));
    }
  }

  /** Record the patches and verifications of a `fix` or `bench` page. */
  savePageOutcome(runId: number, page: PageOutcome): void {
    const insPatch = this.db.prepare(
      `INSERT INTO patches (run_id, file, finding_id, rule_id, tier, before_text, after_text, rationale, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insVer = this.db.prepare(
      `INSERT INTO verifications (run_id, patch_id, file, finding_id, status, reason, rule_gone, suspicious, included, new_violations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insFinding = this.db.prepare(
      "INSERT INTO findings (run_id, file, finding_id, rule_id, impact, selector, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const o of page.outcomes) {
      const f = o.finding;
      insFinding.run(runId, f.sourceFile, f.id, f.ruleId, f.impact, f.selector, JSON.stringify(f));
      const p = o.generation.patch;
      const patchId = p
        ? Number(
            insPatch.run(runId, f.sourceFile, f.id, f.ruleId, o.generation.tier, p.before, p.after, p.rationale, p.confidence)
              .lastInsertRowid,
          )
        : null;
      const v = o.verification;
      insVer.run(
        runId,
        patchId,
        f.sourceFile,
        f.id,
        v.status,
        v.reason,
        v.ruleGone ? 1 : 0,
        v.suspicious ? 1 : 0,
        o.included ? 1 : 0,
        JSON.stringify(v.newViolations),
      );
    }
  }

  /** Read-only escape hatch for reports and tests. */
  query(sql: string, ...params: unknown[]): Record<string, unknown>[] {
    return this.db.prepare(sql).all(...params);
  }
}

function now(): string {
  return new Date().toISOString();
}
