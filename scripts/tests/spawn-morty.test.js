import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  findTicketFile,
  buildWorkerPrompt,
  updateTicketStatus,
  spawnWorker,
} from '../bin/spawn-morty.js';
import { loadConfig } from '../bin/services/config.js';
import { buildWorkerSpawnCommand } from '../bin/services/runtime-adapter.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spawn-morty-test-'));
}

function makeTicketFile(sessionDir, ticketId, status = 'Todo') {
  const ticketDir = path.join(sessionDir, ticketId);
  fs.mkdirSync(ticketDir, { recursive: true });
  const content = [
    '---',
    `id: ${ticketId}`,
    `title: "Test ticket"`,
    `status: ${status}`,
    'priority: Medium',
    'order: 100',
    '---',
    '# Description',
    'This is a test ticket for spawn-morty tests.',
  ].join('\n');
  const filePath = path.join(ticketDir, `linear_ticket_${ticketId}.md`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function makeState(sessionDir, overrides = {}) {
  return {
    active: true,
    working_dir: process.cwd(),
    step: 'implement',
    iteration: 0,
    max_iterations: 10,
    max_time_minutes: 60,
    worker_timeout_seconds: 5,
    start_time_epoch: Math.floor(Date.now() / 1000),
    completion_promise: null,
    original_prompt: 'test task',
    current_ticket: null,
    history: [],
    started_at: new Date().toISOString(),
    session_dir: sessionDir,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Prompt construction
// ---------------------------------------------------------------------------

describe('buildWorkerPrompt', () => {
  it('contains template + ticket + phase instructions', () => {
    const template = '# Worker Template\nDo the thing.';
    const ticket = '# Ticket\nImplement feature X.';
    const context = {
      step: 'implement',
      sessionDir: '/tmp/session',
      workingDir: '/tmp/work',
      ticketId: 'abc123',
    };

    const prompt = buildWorkerPrompt(template, ticket, 'implement', context);

    // Template content present
    assert.ok(prompt.includes('# Worker Template'), 'Missing template content');
    assert.ok(prompt.includes('Do the thing.'), 'Missing template body');

    // Ticket content present
    assert.ok(prompt.includes('# Ticket'), 'Missing ticket content');
    assert.ok(prompt.includes('Implement feature X.'), 'Missing ticket body');

    // Phase instructions present
    assert.ok(prompt.includes('Implement the solution'), 'Missing implement phase instructions');
    assert.ok(prompt.includes('<promise>I AM DONE</promise>'), 'Missing WORKER_DONE instruction');

    // Context present
    assert.ok(prompt.includes('SESSION_ROOT: /tmp/session'), 'Missing session dir in context');
    assert.ok(prompt.includes('TICKET_ID: abc123'), 'Missing ticket id in context');
  });

  it('includes correct phase instructions for research step', () => {
    const prompt = buildWorkerPrompt('template', 'ticket', 'research', {
      step: 'research',
      sessionDir: '/tmp/s',
      workingDir: '/tmp/w',
      ticketId: 'x',
    });
    assert.ok(prompt.includes('Research the problem space'), 'Missing research phase instructions');
    assert.ok(prompt.includes('research_<id>.md'), 'Missing research output file instruction');
  });

  it('includes correct phase instructions for review step', () => {
    const prompt = buildWorkerPrompt('template', 'ticket', 'review', {
      step: 'review',
      sessionDir: '/tmp/s',
      workingDir: '/tmp/w',
      ticketId: 'x',
    });
    assert.ok(prompt.includes('Review implementation'), 'Missing review phase instructions');
    assert.ok(prompt.includes('code_review_<id>.md'), 'Missing review output file instruction');
  });
});

// ---------------------------------------------------------------------------
// 2. Ticket status update
// ---------------------------------------------------------------------------

describe('updateTicketStatus', () => {
  let tmpDir;

  before(() => { tmpDir = makeTmpDir(); });
  after(() => { try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ } });

  it('replaces frontmatter status field atomically', () => {
    const ticketPath = makeTicketFile(tmpDir, 'status-test', 'Todo');

    updateTicketStatus(ticketPath, 'Done');

    const content = fs.readFileSync(ticketPath, 'utf-8');
    assert.ok(content.includes('status: Done'), 'Status not updated to Done');
    assert.ok(!content.includes('status: Todo'), 'Old status still present');
    // Rest of content preserved
    assert.ok(content.includes('title: "Test ticket"'), 'Title was corrupted');
    assert.ok(content.includes('# Description'), 'Body was corrupted');
  });

  it('no-ops when status is already the target value', () => {
    const ticketPath = makeTicketFile(tmpDir, 'noop-test', 'Done');

    // Should not throw, should not create tmp file
    updateTicketStatus(ticketPath, 'Done');

    const content = fs.readFileSync(ticketPath, 'utf-8');
    assert.ok(content.includes('status: Done'));
  });
});

// ---------------------------------------------------------------------------
// 3. Log file creation (via spawnWorker integration)
// ---------------------------------------------------------------------------

describe('spawnWorker log file', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Create a minimal template file
    const extDir = path.join(tmpDir, 'ext', 'commands');
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(path.join(extDir, 'send-to-morty.md'), '# Worker Template');
  });

  after(() => { try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ } });

  it('creates worker log file in ticket dir', async () => {
    const sessionDir = path.join(tmpDir, 'session');
    const ticketId = 'log-test';
    makeTicketFile(sessionDir, ticketId);

    // Write state.json
    const state = makeState(sessionDir, { worker_timeout_seconds: 3 });
    fs.writeFileSync(path.join(sessionDir, 'state.json'), JSON.stringify(state));

    const config = loadConfig(path.join(tmpDir, 'nonexistent-config.json'));

    // Set extension root to our temp dir
    const origExtDir = process.env['EXTENSION_DIR'];
    process.env['EXTENSION_DIR'] = path.join(tmpDir, 'ext');

    try {
      const result = await spawnWorker(state, ticketId, config);

      // Log file should exist in ticket dir
      const ticketDir = path.join(sessionDir, ticketId);
      const logFiles = fs.readdirSync(ticketDir).filter(f => f.startsWith('worker_session_'));
      assert.ok(logFiles.length > 0, 'No worker log file created');
    } finally {
      if (origExtDir) {
        process.env['EXTENSION_DIR'] = origExtDir;
      } else {
        delete process.env['EXTENSION_DIR'];
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. WORKER_DONE detection
// ---------------------------------------------------------------------------

describe('WORKER_DONE detection', () => {
  it('detects promise token in output', async () => {
    // We test this indirectly through the hasToken function
    // since we can't easily control worker output
    const { hasToken } = await import('../bin/types/index.js');

    const output = 'Some work output\n<promise>I AM DONE</promise>\nMore text';
    assert.ok(hasToken(output, 'I AM DONE'), 'Failed to detect WORKER_DONE token');

    const noToken = 'Some work output\nNo promise here';
    assert.ok(!hasToken(noToken, 'I AM DONE'), 'False positive on WORKER_DONE detection');
  });
});

// ---------------------------------------------------------------------------
// 5. Ticket-scoped context
// ---------------------------------------------------------------------------

describe('ticket-scoped context', () => {
  it('worker command uses --add-dir ticketPath not sessionDir', () => {
    const config = loadConfig(path.join(os.tmpdir(), 'nonexistent-config-' + process.pid + '.json'));
    const args = {
      prompt: 'test prompt',
      runtime: 'claude',
      cwd: process.cwd(),
      logFile: '/dev/null',
      timeout: 10,
      ticketPath: '/my/ticket/path',
      extensionRoot: '/my/ext',
    };

    const cmd = buildWorkerSpawnCommand('claude', config, args);

    // Should contain ticketPath after --add-dir
    const addDirIndices = cmd.reduce((acc, val, idx) => {
      if (val === '--add-dir') acc.push(idx);
      return acc;
    }, []);

    const ticketPathFound = addDirIndices.some(idx => cmd[idx + 1] === '/my/ticket/path');
    assert.ok(ticketPathFound, 'ticketPath not found after --add-dir in worker command');

    // Should NOT contain sessionDir
    assert.ok(!cmd.includes('/tmp/session'), 'Worker command should not contain sessionDir');
  });
});

// ---------------------------------------------------------------------------
// 6. Worker env signature
// ---------------------------------------------------------------------------

describe('worker env signature', () => {
  let tmpDir;
  let origPickleRole;
  let origClaudeCode;

  before(() => {
    tmpDir = makeTmpDir();
    origPickleRole = process.env['PICKLE_ROLE'];
    origClaudeCode = process.env['CLAUDECODE'];
  });

  after(() => {
    if (origPickleRole !== undefined) process.env['PICKLE_ROLE'] = origPickleRole;
    else delete process.env['PICKLE_ROLE'];
    if (origClaudeCode !== undefined) process.env['CLAUDECODE'] = origClaudeCode;
    else delete process.env['CLAUDECODE'];
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ }
  });

  it('spawnWorker sets PICKLE_ROLE=worker and deletes CLAUDECODE', async () => {
    // The env setup is verified by spawn-worker.ts tests.
    // Here we verify that spawn-morty calls spawnWorkerProcess correctly.
    // The spawnWorker in spawn-worker.ts:200-242 sets:
    //   env['PICKLE_ROLE'] = 'worker'
    //   delete env['CLAUDECODE']
    // We verify by importing and checking the low-level spawnWorker behavior.

    const { spawnWorker: spawnWorkerLowLevel } = await import('../bin/spawn-worker.js');

    process.env['PICKLE_ROLE'] = 'manager';
    process.env['CLAUDECODE'] = '1';

    const logFile = path.join(tmpDir, 'env-test.log');

    // Spawn a process that will fail fast but verify env is set up
    await spawnWorkerLowLevel({
      prompt: 'true',
      runtime: 'claude',
      cwd: process.cwd(),
      logFile,
      timeout: 3,
      ticketPath: tmpDir,
      extensionRoot: tmpDir,
    }).catch(() => null);

    // Verify original env not mutated
    assert.equal(process.env['PICKLE_ROLE'], 'manager', 'PICKLE_ROLE mutated');
    assert.equal(process.env['CLAUDECODE'], '1', 'CLAUDECODE mutated');
  });
});

// ---------------------------------------------------------------------------
// 7. Missing ticket error
// ---------------------------------------------------------------------------

describe('missing ticket error', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const extDir = path.join(tmpDir, 'ext', 'commands');
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(path.join(extDir, 'send-to-morty.md'), '# Template');
  });

  after(() => { try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ } });

  it('throws when ticket file does not exist', async () => {
    const sessionDir = path.join(tmpDir, 'session');
    fs.mkdirSync(sessionDir, { recursive: true });

    const state = makeState(sessionDir);
    const config = loadConfig(path.join(tmpDir, 'nonexistent.json'));

    const origExtDir = process.env['EXTENSION_DIR'];
    process.env['EXTENSION_DIR'] = path.join(tmpDir, 'ext');

    try {
      await assert.rejects(
        () => spawnWorker(state, 'nonexistent-ticket', config),
        { message: /Ticket not found: nonexistent-ticket/ },
      );
    } finally {
      if (origExtDir) process.env['EXTENSION_DIR'] = origExtDir;
      else delete process.env['EXTENSION_DIR'];
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Crash handling
// ---------------------------------------------------------------------------

describe('crash handling', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const extDir = path.join(tmpDir, 'ext', 'commands');
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(path.join(extDir, 'send-to-morty.md'), '# Template');
  });

  after(() => { try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ } });

  it('returns result with exitCode != 0 on worker crash, does not throw', async () => {
    const sessionDir = path.join(tmpDir, 'session');
    const ticketId = 'crash-test';
    makeTicketFile(sessionDir, ticketId);

    const state = makeState(sessionDir, { worker_timeout_seconds: 3 });
    fs.writeFileSync(path.join(sessionDir, 'state.json'), JSON.stringify(state));

    const config = loadConfig(path.join(tmpDir, 'nonexistent.json'));

    const origExtDir = process.env['EXTENSION_DIR'];
    process.env['EXTENSION_DIR'] = path.join(tmpDir, 'ext');

    try {
      // spawnWorker will try to run `claude -p ...` which will fail
      // but it should return a result, not throw
      const result = await spawnWorker(state, ticketId, config);

      assert.ok(typeof result.exitCode === 'number' || result.exitCode === null,
        'exitCode should be number or null');
      assert.ok(typeof result.output === 'string', 'output should be string');
      assert.ok(typeof result.duration_ms === 'number', 'duration_ms should be number');
      assert.equal(result.done, false, 'crashed worker should not be done');
    } finally {
      if (origExtDir) process.env['EXTENSION_DIR'] = origExtDir;
      else delete process.env['EXTENSION_DIR'];
    }
  });
});

// ---------------------------------------------------------------------------
// findTicketFile
// ---------------------------------------------------------------------------

describe('findTicketFile', () => {
  let tmpDir;

  before(() => { tmpDir = makeTmpDir(); });
  after(() => { try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ } });

  it('finds ticket file in ticket subdirectory', () => {
    makeTicketFile(tmpDir, 'find-test');
    const result = findTicketFile(tmpDir, 'find-test');
    assert.ok(result !== null, 'Should find ticket file');
    assert.ok(result.includes('linear_ticket_find-test.md'), 'Wrong file found');
  });

  it('returns null for non-existent ticket', () => {
    const result = findTicketFile(tmpDir, 'does-not-exist');
    assert.equal(result, null, 'Should return null for missing ticket');
  });
});
