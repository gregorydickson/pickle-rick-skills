import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs,
  formatOutput,
  deduplicateCommits,
  getGitCommits,
} from '../bin/standup.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('standup', () => {
  it('formatOutput produces formatted summary grouped by session', () => {
    const events = [
      { ts: '2026-03-09T08:00:00Z', event: 'session_start', source: 'pickle', session: 'sess-1', original_prompt: 'Implement feature X' },
      { ts: '2026-03-09T08:30:00Z', event: 'iteration_start', source: 'hook', session: 'sess-1', iteration: 1 },
      { ts: '2026-03-09T09:00:00Z', event: 'iteration_end', source: 'hook', session: 'sess-1', iteration: 1 },
      { ts: '2026-03-09T09:30:00Z', event: 'session_end', source: 'pickle', session: 'sess-1' },
    ];
    const hookCommits = [
      { ts: '2026-03-09T08:45:00Z', event: 'commit', source: 'hook', session: 'sess-1', commit_hash: 'abc1234567', commit_message: 'feat: add X' },
    ];
    const gitOnlyCommits = [];
    const since = new Date('2026-03-09T00:00:00');
    const until = new Date('2026-03-10T00:00:00');

    const output = formatOutput(events, hookCommits, gitOnlyCommits, since, until);

    assert.ok(output.includes('Standup'), 'output must contain Standup heading');
    assert.ok(output.includes('sess-1'), 'output must contain session ID');
    assert.ok(output.includes('Implement feature X'), 'output must contain task name');
    assert.ok(output.includes('abc1234'), 'output must contain commit hash');
    assert.ok(output.includes('feat: add X'), 'output must contain commit message');
    assert.ok(output.includes('Duration'), 'output must contain Duration');
    assert.ok(output.includes('1 iteration'), 'output must contain iteration count');
  });

  it('formatOutput handles no activity', () => {
    const since = new Date('2026-03-09T00:00:00');
    const until = new Date('2026-03-10T00:00:00');
    const output = formatOutput([], [], [], since, until);
    assert.ok(output.includes('No activity found'), 'must show no activity message');
  });

  it('formatOutput shows ad-hoc activity for events without session', () => {
    const events = [
      { ts: '2026-03-09T10:30:00Z', event: 'feature', source: 'persona', title: 'Quick fix' },
    ];
    const since = new Date('2026-03-09T00:00:00');
    const until = new Date('2026-03-10T00:00:00');

    const output = formatOutput(events, [], [], since, until);
    assert.ok(output.includes('Ad-hoc Activity'), 'must show Ad-hoc Activity section');
    assert.ok(output.includes('feature'), 'must contain event type');
    assert.ok(output.includes('Quick fix'), 'must contain event title');
  });

  it('deduplicateCommits separates hook vs git-only commits', () => {
    const events = [
      { ts: '2026-03-09T08:45:00Z', event: 'commit', source: 'hook', commit_hash: 'abc1234567', commit_message: 'feat: add X' },
    ];
    const gitCommits = new Map([
      ['abc1234567', 'feat: add X'],
      ['def5678901', 'fix: bug Y'],
    ]);

    const { hookCommits, gitOnlyCommits } = deduplicateCommits(events, gitCommits);
    assert.equal(hookCommits.length, 1, 'one hook commit');
    assert.equal(gitOnlyCommits.length, 1, 'one git-only commit');
    assert.equal(gitOnlyCommits[0][0], 'def5678901');
  });

  it('parseArgs defaults to 1 day', () => {
    const { range, json } = parseArgs([]);
    assert.equal(json, false);
    const diffMs = range.until.getTime() - range.since.getTime();
    const diffDays = diffMs / 86400000;
    assert.ok(diffDays >= 1 && diffDays <= 3, `range should be ~2 days (since to tomorrow), got ${diffDays}`);
  });

  it('parseArgs handles --since flag', () => {
    const { range } = parseArgs(['--since', '2026-03-01']);
    const sinceStr = range.since.toISOString().slice(0, 10);
    assert.equal(sinceStr, '2026-03-01');
  });

  it('parseArgs handles --json flag', () => {
    const { json } = parseArgs(['--json']);
    assert.equal(json, true);
  });

  it('formatOutput filters empty sessions (lifecycle only)', () => {
    const events = [
      { ts: '2026-03-09T08:00:00Z', event: 'session_start', source: 'pickle', session: 'empty-sess' },
      { ts: '2026-03-09T08:01:00Z', event: 'session_end', source: 'pickle', session: 'empty-sess' },
      { ts: '2026-03-09T10:00:00Z', event: 'session_start', source: 'pickle', session: 'real-sess' },
      { ts: '2026-03-09T10:30:00Z', event: 'iteration_start', source: 'hook', session: 'real-sess' },
      { ts: '2026-03-09T11:00:00Z', event: 'session_end', source: 'pickle', session: 'real-sess' },
    ];
    const since = new Date('2026-03-09T00:00:00');
    const until = new Date('2026-03-10T00:00:00');

    const output = formatOutput(events, [], [], since, until);
    assert.ok(!output.includes('empty-sess'), 'empty session must be filtered out');
    assert.ok(output.includes('real-sess'), 'real session must be included');
  });
});
