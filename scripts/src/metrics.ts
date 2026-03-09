import * as path from 'path';
import * as os from 'os';
import { readActivityLogs } from './services/activity-logger.js';
import { getExtensionRoot } from './services/config.js';
import {
  aggregateActivityLogs,
  scanGitRepos,
  buildReport,
  formatNumber,
  readMetricsCache,
  writeMetricsCache,
  isCacheValid,
  type MetricsReport,
  type MetricsRow,
  type MetricsTotals,
} from './services/metrics-utils.js';

// ---------------------------------------------------------------------------
// Arg Parsing
// ---------------------------------------------------------------------------

interface ParsedMetricsArgs {
  days: number;
  since: string | null;
  weekly: boolean;
  json: boolean;
}

function consumeArg(argv: string[], i: number, flag: string, hint: string): string {
  const val = argv[i + 1];
  if (val === undefined || val.startsWith('--')) {
    console.error(`Error: ${flag} requires ${hint}.`);
    process.exit(1);
  }
  return val;
}

export function parseMetricsArgs(argv: string[]): ParsedMetricsArgs {
  let days: number | null = null;
  let since: string | null = null;
  let weekly = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--days') {
      const val = consumeArg(argv, i, '--days', 'a numeric value');
      i++;
      days = Number(val);
      if (!Number.isFinite(days) || days < 0 || Math.floor(days) !== days) {
        console.error(`Error: --days must be a non-negative integer, got "${val}".`);
        process.exit(1);
      }
    } else if (arg === '--since') {
      since = consumeArg(argv, i, '--since', 'a YYYY-MM-DD date');
      i++;
    } else if (arg === '--weekly') {
      weekly = true;
    } else if (arg === '--json') {
      json = true;
    } else {
      console.error(`Error: unknown flag "${arg}".`);
      process.exit(1);
    }
  }

  if (weekly && days === null && since === null) {
    days = 28;
  }

  return { days: days ?? 7, since, weekly, json };
}

// ---------------------------------------------------------------------------
// Date Computation
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function computeDateRange(args: ParsedMetricsArgs): { since: string; until: string } {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(todayMidnight);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const until = toDateStr(tomorrow);

  if (args.since !== null) {
    const parsed = new Date(args.since + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      console.error(`Error: invalid date "${args.since}". Use YYYY-MM-DD format.`);
      process.exit(1);
    }
    if (parsed >= tomorrow) {
      console.error(`Error: --since date "${args.since}" is in the future.`);
      process.exit(1);
    }
    return { since: toDateStr(parsed), until };
  }

  const sinceDate = new Date(todayMidnight);
  if (args.days === 0) {
    return { since: toDateStr(todayMidnight), until };
  }
  sinceDate.setDate(sinceDate.getDate() - args.days);
  return { since: toDateStr(sinceDate), until };
}

// ---------------------------------------------------------------------------
// Table Formatter
// ---------------------------------------------------------------------------

interface TableColumn {
  header: string;
  align: 'left' | 'right';
  values: string[];
}

function printTable(columns: TableColumn[]): void {
  const widths = columns.map((col) => {
    const maxVal = Math.max(...col.values.map((v) => v.length), 0);
    return Math.max(col.header.length, maxVal);
  });

  const headerCells = columns.map((col, i) =>
    col.align === 'right' ? col.header.padStart(widths[i]) : col.header.padEnd(widths[i])
  );
  process.stdout.write(`  ${headerCells.join('   ')}\n`);

  const sep = widths.map((w) => '-'.repeat(w)).join('---');
  process.stdout.write(`  ${sep}\n`);

  const rowCount = columns[0]?.values.length ?? 0;
  for (let row = 0; row < rowCount; row++) {
    const cells = columns.map((col, i) => {
      const val = col.values[row] ?? '';
      return col.align === 'right' ? val.padStart(widths[i]) : val.padEnd(widths[i]);
    });
    process.stdout.write(`  ${cells.join('   ')}\n`);
  }
}

function aggregateRow(row: MetricsRow): MetricsTotals {
  const t: MetricsTotals = { turns: 0, input: 0, output: 0, cache_read: 0, cache_create: 0, commits: 0, added: 0, removed: 0 };
  for (const tokens of Object.values(row.projects)) {
    t.turns += tokens.turns;
    t.input += tokens.input;
    t.output += tokens.output;
    t.cache_read += tokens.cache_read;
    t.cache_create += tokens.cache_create;
  }
  for (const loc of Object.values(row.loc)) {
    t.commits += loc.commits;
    t.added += loc.added;
    t.removed += loc.removed;
  }
  return t;
}

function printDailyTable(report: MetricsReport): void {
  console.log(`\nMetrics - ${report.since} to ${report.until}`);
  console.log(`  Events: ${formatNumber(report.totals.turns)}  Commits: ${formatNumber(report.totals.commits)}  Lines: +${formatNumber(report.totals.added)} / -${formatNumber(report.totals.removed)}\n`);

  if (report.rows.length === 0) return;

  const dates: string[] = [];
  const turns: string[] = [];
  const commits: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const row of report.rows) {
    dates.push(row.date);
    const rowTotals = aggregateRow(row);
    turns.push(formatNumber(rowTotals.turns));
    commits.push(formatNumber(rowTotals.commits));
    added.push('+' + formatNumber(rowTotals.added));
    removed.push('-' + formatNumber(rowTotals.removed));
  }

  printTable([
    { header: 'Date', align: 'left', values: dates },
    { header: 'Events', align: 'right', values: turns },
    { header: 'Commits', align: 'right', values: commits },
    { header: '+Lines', align: 'right', values: added },
    { header: '-Lines', align: 'right', values: removed },
  ]);
  process.stdout.write('\n');
}

function printWeeklyTable(report: MetricsReport): void {
  console.log(`\nMetrics (Weekly) - ${report.since} to ${report.until}`);
  console.log(`  Events: ${formatNumber(report.totals.turns)}  Commits: ${formatNumber(report.totals.commits)}\n`);

  if (report.rows.length === 0) return;
  printDailyTable(report); // Simplified — reuse daily format for weekly grouping
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseMetricsArgs(process.argv.slice(2));
  const { since, until } = computeDateRange(args);
  const today = new Date().toLocaleDateString('en-CA');

  const cachePath = path.join(getExtensionRoot(), 'metrics-cache.json');
  const cache = readMetricsCache(cachePath);

  let report: MetricsReport;

  if (isCacheValid(cache, today) && cache.report) {
    report = cache.report;
  } else {
    const sinceDate = new Date(since + 'T00:00:00');
    const events = readActivityLogs(sinceDate);
    const activityByDate = aggregateActivityLogs(events);
    const repoRoot = process.env['METRICS_REPO_ROOT'] || path.join(os.homedir(), 'loanlight');
    const loc = scanGitRepos(repoRoot, since);
    const grouping = args.weekly ? 'weekly' : 'daily';
    report = buildReport(activityByDate, loc, since, until, grouping);

    writeMetricsCache(cachePath, { version: 1, date: today, report });
  }

  if (report.rows.length === 0) {
    console.log(`No metrics data found for ${since} to ${until}.`);
    return;
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (args.weekly) {
    printWeeklyTable(report);
  } else {
    printDailyTable(report);
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === 'metrics.js') {
  main();
}
