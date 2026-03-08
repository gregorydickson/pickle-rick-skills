import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  getExtensionRoot,
  buildHandoffSummary,
  collectTickets,
  markTicketDone,
  consumeHandoff,
  withSessionMapLock,
  updateSessionMap,
  removeFromSessionMap,
  pruneOldSessions,
  writeStateFile,
  readStateFile,
} from '../bin/services/pickle-utils.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pickle-utils-test-'));
}

function makeState(overrides = {}) {
  return {
    active: true,
    working_dir: '/tmp/test',
    step: 'research',
    iteration: 3,
    max_iterations: 100,
    max_time_minutes: 60,
    worker_timeout_seconds: 300,
    start_time_epoch: 1700000000,
    completion_promise: null,
    original_prompt: 'Build auth system',
    current_ticket: 'abc123',
    history: [{ step: 'prd', timestamp: '2026-01-01' }],
    started_at: '2026-03-08T00:00:00Z',
    session_dir: '/tmp/session',
    tmux_mode: false,
    min_iterations: 0,
    command_template: '',
    chain_meeseeks: false,
    runtime: 'claude',
    ...overrides,
  };
}

function writeTicket(dir, ticketId, fields = {}) {
  const ticketDir = path.join(dir, ticketId);
  fs.mkdirSync(ticketDir, { recursive: true });
  const defaults = {
    id: ticketId,
    title: `Ticket ${ticketId}`,
    status: 'Todo',
    priority: 'Medium',
    order: 10,
    created: '2026-03-08',
    updated: '2026-03-08',
  };
  const merged = { ...defaults, ...fields };
  const content = [
    '---',
    ...Object.entries(merged).map(([k, v]) => `${k}: "${v}"`),
    '---',
    '',
    '# Description',
    'Test ticket',
  ].join('\n');
  const filePath = path.join(ticketDir, `linear_ticket_${ticketId}.md`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// ---------------------------------------------------------------------------
// buildHandoffSummary tests
// ---------------------------------------------------------------------------

describe('buildHandoffSummary', () => {
  it('starts with context header', () => {
    const dir = tmpDir();
    const summary = buildHandoffSummary(makeState(), dir);
    assert.ok(summary.startsWith('=== PICKLE RICK LOOP CONTEXT ==='));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('includes current phase', () => {
    const dir = tmpDir();
    const summary = buildHandoffSummary(makeState({ step: 'research' }), dir);
    assert.ok(summary.includes('Phase: research'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('includes iteration count', () => {
    const dir = tmpDir();
    const summary = buildHandoffSummary(makeState({ iteration: 3, max_iterations: 100 }), dir);
    assert.ok(summary.includes('Iteration: 3 [of 100]'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('renders ticket checklist with status symbols', () => {
    const dir = tmpDir();
    writeTicket(dir, 'done-1', { status: 'Done', order: 10 });
    writeTicket(dir, 'wip-2', { status: 'In Progress', order: 20 });
    writeTicket(dir, 'todo-3', { status: 'Todo', order: 30 });
    const summary = buildHandoffSummary(makeState(), dir);
    assert.ok(summary.includes('[x] done-1:'));
    assert.ok(summary.includes('[~] wip-2:'));
    assert.ok(summary.includes('[ ] todo-3:'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects first iteration via history.length === 0', () => {
    const dir = tmpDir();
    const summary = buildHandoffSummary(makeState({ history: [] }), dir);
    assert.ok(summary.includes('THIS IS A NEW SESSION'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('truncates long tasks to 300 chars with ... suffix', () => {
    const dir = tmpDir();
    const longTask = 'x'.repeat(500);
    const summary = buildHandoffSummary(makeState({ original_prompt: longTask }), dir);
    assert.ok(summary.includes('x'.repeat(300) + '...'));
    assert.ok(!summary.includes('x'.repeat(301)));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shows min passes when > 0', () => {
    const dir = tmpDir();
    const summary = buildHandoffSummary(makeState({ min_iterations: 10 }), dir);
    assert.ok(summary.includes('Min Passes: 10'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// consumeHandoff tests
// ---------------------------------------------------------------------------

describe('consumeHandoff', () => {
  it('reads and deletes handoff.txt', () => {
    const dir = tmpDir();
    const handoffPath = path.join(dir, 'handoff.txt');
    fs.writeFileSync(handoffPath, 'handoff content');
    const result = consumeHandoff(dir);
    assert.equal(result, 'handoff content');
    assert.ok(!fs.existsSync(handoffPath));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no handoff.txt', () => {
    const dir = tmpDir();
    const result = consumeHandoff(dir);
    assert.equal(result, null);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// writeStateFile / readStateFile (atomic write) tests
// ---------------------------------------------------------------------------

describe('writeStateFile (atomic)', () => {
  it('written state is readable immediately after', () => {
    const dir = tmpDir();
    const state = makeState();
    writeStateFile(dir, state);
    const read = readStateFile(dir);
    assert.equal(read.step, 'research');
    assert.equal(read.iteration, 3);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// withSessionMapLock tests
// ---------------------------------------------------------------------------

describe('withSessionMapLock', () => {
  it('O_EXCL prevents concurrent access', async () => {
    const dir = tmpDir();
    const origEnv = process.env.EXTENSION_DIR;
    process.env.EXTENSION_DIR = dir;
    try {
      const order = [];
      const p1 = withSessionMapLock(async () => {
        order.push('p1-start');
        await new Promise(r => setTimeout(r, 100));
        order.push('p1-end');
        return 1;
      });
      // Small delay to ensure p1 acquires lock first
      await new Promise(r => setTimeout(r, 10));
      const p2 = withSessionMapLock(async () => {
        order.push('p2-start');
        return 2;
      });
      const [r1, r2] = await Promise.all([p1, p2]);
      assert.equal(r1, 1);
      assert.equal(r2, 2);
      // p1 should complete before p2 starts
      assert.ok(order.indexOf('p1-end') < order.indexOf('p2-start'));
    } finally {
      process.env.EXTENSION_DIR = origEnv;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('steals locks older than 5s', async () => {
    const dir = tmpDir();
    const origEnv = process.env.EXTENSION_DIR;
    process.env.EXTENSION_DIR = dir;
    try {
      // Create a stale lock file with old mtime
      const lockPath = path.join(dir, 'current_sessions.json.lock');
      fs.writeFileSync(lockPath, '');
      const oldTime = Date.now() - 10000; // 10 seconds ago
      fs.utimesSync(lockPath, new Date(oldTime), new Date(oldTime));

      const result = await withSessionMapLock(() => 42);
      assert.equal(result, 42);
    } finally {
      process.env.EXTENSION_DIR = origEnv;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// collectTickets tests
// ---------------------------------------------------------------------------

describe('collectTickets', () => {
  it('finds tickets sorted by order', () => {
    const dir = tmpDir();
    writeTicket(dir, 'c', { order: 30 });
    writeTicket(dir, 'a', { order: 10 });
    writeTicket(dir, 'b', { order: 20 });
    const tickets = collectTickets(dir);
    assert.equal(tickets.length, 3);
    assert.equal(tickets[0].id, 'a');
    assert.equal(tickets[1].id, 'b');
    assert.equal(tickets[2].id, 'c');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// pruneOldSessions tests
// ---------------------------------------------------------------------------

describe('pruneOldSessions', () => {
  it('removes sessions older than 7 days', () => {
    const dir = tmpDir();
    const oldSession = path.join(dir, 'old-session');
    fs.mkdirSync(oldSession);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(oldSession, 'state.json'),
      JSON.stringify({ active: false, started_at: eightDaysAgo })
    );
    pruneOldSessions(dir);
    assert.ok(!fs.existsSync(oldSession));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps recent sessions', () => {
    const dir = tmpDir();
    const freshSession = path.join(dir, 'fresh-session');
    fs.mkdirSync(freshSession);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(freshSession, 'state.json'),
      JSON.stringify({ active: false, started_at: oneDayAgo })
    );
    pruneOldSessions(dir);
    assert.ok(fs.existsSync(freshSession));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// getExtensionRoot tests
// ---------------------------------------------------------------------------

describe('getExtensionRoot', () => {
  it('respects EXTENSION_DIR env', () => {
    const origEnv = process.env.EXTENSION_DIR;
    process.env.EXTENSION_DIR = '/custom/path';
    try {
      assert.equal(getExtensionRoot(), '/custom/path');
    } finally {
      if (origEnv === undefined) {
        delete process.env.EXTENSION_DIR;
      } else {
        process.env.EXTENSION_DIR = origEnv;
      }
    }
  });
});
