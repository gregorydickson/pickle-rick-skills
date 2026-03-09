import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  formatNumber,
  aggregateActivityLogs,
  parseGitLogOutput,
  buildReport,
  readMetricsCache,
  writeMetricsCache,
  isCacheValid,
} from '../bin/services/metrics-utils.js';
import { parseMetricsArgs } from '../bin/metrics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('metrics-utils', () => {
  it('formatNumber formats correctly', () => {
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(500), '500');
    assert.equal(formatNumber(1500), '1.5K');
    assert.equal(formatNumber(2500000), '2.5M');
    assert.equal(formatNumber(3000000000), '3.0B');
    assert.equal(formatNumber(-1500), '-1.5K');
  });

  it('aggregateActivityLogs groups events by date', () => {
    const events = [
      { ts: '2026-03-08T10:00:00Z', event: 'session_start', source: 'pickle', duration_min: 30 },
      { ts: '2026-03-08T11:00:00Z', event: 'session_end', source: 'pickle', duration_min: 10 },
      { ts: '2026-03-09T08:00:00Z', event: 'ticket_completed', source: 'hook' },
    ];

    const result = aggregateActivityLogs(events);
    assert.ok(result.has('2026-03-08'), 'must have 2026-03-08');
    assert.ok(result.has('2026-03-09'), 'must have 2026-03-09');

    const day8 = result.get('2026-03-08');
    assert.equal(day8.turns, 2, 'two events on March 8');
    assert.equal(day8.output, 2400, '30*60 + 10*60 = 2400 seconds as output proxy');

    const day9 = result.get('2026-03-09');
    assert.equal(day9.turns, 1, 'one event on March 9');
  });

  it('parseGitLogOutput parses commit dates and stats', () => {
    const output = [
      '2026-03-08T10:00:00-05:00',
      ' 3 files changed, 50 insertions(+), 10 deletions(-)',
      '2026-03-08T14:00:00-05:00',
      ' 1 file changed, 5 insertions(+)',
      '2026-03-09T09:00:00-05:00',
      ' 2 files changed, 20 insertions(+), 15 deletions(-)',
    ].join('\n');

    const result = parseGitLogOutput(output);
    assert.ok(result.has('2026-03-08'));
    const day8 = result.get('2026-03-08');
    assert.equal(day8.commits, 2);
    assert.equal(day8.added, 55);
    assert.equal(day8.removed, 10);

    assert.ok(result.has('2026-03-09'));
    const day9 = result.get('2026-03-09');
    assert.equal(day9.commits, 1);
    assert.equal(day9.added, 20);
    assert.equal(day9.removed, 15);
  });

  it('buildReport produces correct totals', () => {
    const activityByDate = new Map();
    activityByDate.set('2026-03-08', { turns: 5, input: 0, output: 100, cache_read: 0, cache_create: 0 });

    const loc = new Map();
    const repoLoc = new Map();
    repoLoc.set('2026-03-08', { commits: 3, added: 50, removed: 10 });
    loc.set('test-repo', repoLoc);

    const report = buildReport(activityByDate, loc, '2026-03-08', '2026-03-09', 'daily');
    assert.equal(report.rows.length, 1);
    assert.equal(report.totals.turns, 5);
    assert.equal(report.totals.commits, 3);
    assert.equal(report.totals.added, 50);
    assert.equal(report.totals.removed, 10);
    assert.equal(report.since, '2026-03-08');
    assert.equal(report.until, '2026-03-09');
  });
});

describe('metrics cache', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writeMetricsCache creates cache file and readMetricsCache reads it back', () => {
    const cachePath = path.join(tmpDir, 'metrics-cache.json');
    const cache = {
      version: 1,
      date: '2026-03-09',
      report: {
        since: '2026-03-08',
        until: '2026-03-09',
        grouping: 'daily',
        rows: [],
        projects: [],
        totals: { turns: 10, input: 0, output: 200, cache_read: 0, cache_create: 0, commits: 5, added: 100, removed: 20 },
      },
    };

    writeMetricsCache(cachePath, cache);
    assert.ok(fs.existsSync(cachePath), 'cache file must exist after write');

    const loaded = readMetricsCache(cachePath);
    assert.equal(loaded.version, 1);
    assert.equal(loaded.date, '2026-03-09');
    assert.deepEqual(loaded.report.totals, cache.report.totals);
  });

  it('isCacheValid returns true for matching date', () => {
    const cache = { version: 1, date: '2026-03-09', report: { rows: [] } };
    assert.ok(isCacheValid(cache, '2026-03-09'));
    assert.ok(!isCacheValid(cache, '2026-03-08'));
  });

  it('readMetricsCache returns empty cache for missing file', () => {
    const cache = readMetricsCache(path.join(tmpDir, 'nonexistent.json'));
    assert.equal(cache.version, 1);
    assert.equal(cache.date, '');
    assert.equal(cache.report, null);
  });
});

describe('metrics CLI arg parsing', () => {
  it('--days parses correctly', () => {
    const args = parseMetricsArgs(['--days', '14']);
    assert.equal(args.days, 14);
    assert.equal(args.weekly, false);
    assert.equal(args.json, false);
  });

  it('--json flag parses correctly', () => {
    const args = parseMetricsArgs(['--json']);
    assert.equal(args.json, true);
    assert.equal(args.days, 7); // default
  });

  it('--weekly defaults to 28 days when no range given', () => {
    const args = parseMetricsArgs(['--weekly']);
    assert.equal(args.weekly, true);
    assert.equal(args.days, 28);
  });

  it('--since parses correctly', () => {
    const args = parseMetricsArgs(['--since', '2026-03-01']);
    assert.equal(args.since, '2026-03-01');
  });

  it('default is 7 days', () => {
    const args = parseMetricsArgs([]);
    assert.equal(args.days, 7);
    assert.equal(args.since, null);
  });
});
