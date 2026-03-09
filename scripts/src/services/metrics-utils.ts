import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import type { ActivityEvent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyTokens {
  turns: number;
  input: number;
  output: number;
  cache_read: number;
  cache_create: number;
}

export interface DailyLOC {
  commits: number;
  added: number;
  removed: number;
}

export interface MetricsTotals {
  turns: number;
  input: number;
  output: number;
  cache_read: number;
  cache_create: number;
  commits: number;
  added: number;
  removed: number;
}

export interface ProjectSummary {
  slug: string;
  label: string;
  totals: MetricsTotals;
}

export interface MetricsRow {
  date: string;
  projects: Record<string, DailyTokens>;
  loc: Record<string, DailyLOC>;
}

export interface MetricsReport {
  since: string;
  until: string;
  grouping: string;
  rows: MetricsRow[];
  projects: ProjectSummary[];
  totals: MetricsTotals;
}

export interface MetricsCache {
  version: number;
  date: string;
  report: MetricsReport | null;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

export function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ---------------------------------------------------------------------------
// Activity Log Aggregation
// ---------------------------------------------------------------------------

function emptyDailyTokens(): DailyTokens {
  return { turns: 0, input: 0, output: 0, cache_read: 0, cache_create: 0 };
}

export function aggregateActivityLogs(
  events: ActivityEvent[],
): Map<string, DailyTokens> {
  const result = new Map<string, DailyTokens>();

  for (const event of events) {
    const date = event.ts.slice(0, 10); // YYYY-MM-DD
    if (!result.has(date)) result.set(date, emptyDailyTokens());
    const dt = result.get(date)!;
    dt.turns += 1;
    if (event.duration_min) {
      dt.output += Math.round(event.duration_min * 60); // proxy: seconds as output
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Git Log Parser
// ---------------------------------------------------------------------------

const STAT_RE = /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;

export function parseGitLogOutput(output: string): Map<string, DailyLOC> {
  const result = new Map<string, DailyLOC>();
  let currentDate: string | null = null;

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (ISO_DATE_RE.test(line)) {
      const d = new Date(line);
      if (isNaN(d.getTime())) continue;
      currentDate = d.toLocaleDateString('en-CA');
      if (!result.has(currentDate)) result.set(currentDate, { commits: 0, added: 0, removed: 0 });
      result.get(currentDate)!.commits += 1;
      continue;
    }

    const m = STAT_RE.exec(line);
    if (m && currentDate) {
      const entry = result.get(currentDate)!;
      entry.added += parseInt(m[2] || '0', 10);
      entry.removed += parseInt(m[3] || '0', 10);
    }
  }

  return result;
}

export function scanGitRepos(repoRoot: string, since: string): Map<string, Map<string, DailyLOC>> {
  const result = new Map<string, Map<string, DailyLOC>>();

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const repoPath = path.join(repoRoot, entry.name);
    const gitDir = path.join(repoPath, '.git');
    try {
      fs.statSync(gitDir);
    } catch { continue; }

    try {
      const proc = spawnSync('git', ['log', `--since=${since}`, '--format=%aI', '--shortstat'], {
        cwd: repoPath,
        encoding: 'utf-8',
        timeout: 30_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if ((proc.status ?? 1) !== 0) continue;
      const locMap = parseGitLogOutput(proc.stdout || '');
      if (locMap.size > 0) result.set(entry.name, locMap);
    } catch {
      // Individual repo failure is non-fatal
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_VERSION = 1;

export function readMetricsCache(cachePath: string): MetricsCache {
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as MetricsCache;
    if (parsed.version !== CACHE_VERSION) return { version: CACHE_VERSION, date: '', report: null };
    return parsed;
  } catch {
    return { version: CACHE_VERSION, date: '', report: null };
  }
}

export function writeMetricsCache(cachePath: string, cache: MetricsCache): void {
  try {
    const dir = path.dirname(cachePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${cachePath}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, cachePath);
  } catch {
    // Cache write failure is non-fatal
  }
}

export function isCacheValid(cache: MetricsCache, date: string): boolean {
  return cache.date === date && cache.report !== null;
}

// ---------------------------------------------------------------------------
// Report Builder
// ---------------------------------------------------------------------------

function emptyTotals(): MetricsTotals {
  return { turns: 0, input: 0, output: 0, cache_read: 0, cache_create: 0, commits: 0, added: 0, removed: 0 };
}

export function buildReport(
  activityByDate: Map<string, DailyTokens>,
  loc: Map<string, Map<string, DailyLOC>>,
  since: string,
  until: string,
  grouping: string,
): MetricsReport {
  const dateSet = new Set<string>();
  for (const date of activityByDate.keys()) dateSet.add(date);
  for (const dateMap of loc.values()) {
    for (const date of dateMap.keys()) dateSet.add(date);
  }
  const dates = [...dateSet].sort();

  const rows: MetricsRow[] = dates.map((date) => {
    const projects: Record<string, DailyTokens> = {};
    const dt = activityByDate.get(date);
    if (dt) projects['activity'] = dt;

    const locData: Record<string, DailyLOC> = {};
    for (const [repo, dateMap] of loc) {
      const dl = dateMap.get(date);
      if (dl) locData[repo] = dl;
    }
    return { date, projects, loc: locData };
  });

  const totals = emptyTotals();
  for (const dt of activityByDate.values()) {
    totals.turns += dt.turns;
    totals.input += dt.input;
    totals.output += dt.output;
    totals.cache_read += dt.cache_read;
    totals.cache_create += dt.cache_create;
  }
  for (const dateMap of loc.values()) {
    for (const dl of dateMap.values()) {
      totals.commits += dl.commits;
      totals.added += dl.added;
      totals.removed += dl.removed;
    }
  }

  const projects: ProjectSummary[] = [];
  if (activityByDate.size > 0) {
    projects.push({ slug: 'activity', label: 'activity', totals: { ...totals } });
  }

  return { since, until, grouping, rows, projects, totals };
}
