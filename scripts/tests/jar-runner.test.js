import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.resolve(__dirname, '..', 'bin');

// Set EXTENSION_DIR to temp before importing
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-runner-test-'));
process.env.EXTENSION_DIR = tmpRoot;

const { writeJarQueue, readJarQueue } = await import('../bin/services/jar-utils.js');
const { buildJarNotification } = await import('../bin/jar-runner.js');

describe('jar-runner', () => {
  let origDir;

  beforeEach(() => {
    origDir = process.env.EXTENSION_DIR;
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-runner-'));
    process.env.EXTENSION_DIR = testDir;
  });

  afterEach(() => {
    process.env.EXTENSION_DIR = origDir;
  });

  it('spawns mux-runner.js not direct CLI', () => {
    // Verify jar-runner.ts source contains spawn with mux-runner.js
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'jar-runner.ts'), 'utf-8');
    assert.ok(source.includes("'mux-runner.js'"), 'must reference mux-runner.js');
    assert.ok(source.includes('spawn('), 'must use child_process.spawn');
    assert.ok(!source.includes("spawn('claude'"), 'must NOT spawn claude directly');
  });

  it('uses manager_max_turns (50) not tmux_max_turns (200)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'jar-runner.ts'), 'utf-8');
    assert.ok(source.includes('manager_max_turns'), 'must reference manager_max_turns');
    assert.ok(!source.includes('tmux_max_turns'), 'must NOT reference tmux_max_turns');
  });

  it('sets completion_promise to JARRED', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'jar-runner.ts'), 'utf-8');
    assert.ok(source.includes("'JARRED'"), 'must set completion_promise to JARRED');
  });

  it('sequential execution — for...of loop, not Promise.all', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'jar-runner.ts'), 'utf-8');
    assert.ok(source.includes('for (const task of pending)'), 'must use sequential for...of');
    assert.ok(!source.includes('Promise.all'), 'must NOT use Promise.all');
  });

  it('empty queue exits cleanly', async () => {
    writeJarQueue({ tasks: [] });
    // Import main and run with empty queue — captures console output
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const { main } = await import('../bin/jar-runner.js');
      await main([]);
    } finally {
      console.log = origLog;
    }
    assert.ok(logs.some(l => l.includes('No tasks queued')), 'must print "No tasks queued"');
  });

  it('task status tracking — integrity_failed for modified PRD', async () => {
    // Create a PRD file and queue it
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-integ-'));
    const prdPath = path.join(tmpDir, 'prd.md');
    fs.writeFileSync(prdPath, '# Original PRD');
    const sha256 = crypto.createHash('sha256').update('# Original PRD').digest('hex');

    writeJarQueue({
      tasks: [{
        id: 'task-integ-1',
        prd_path: prdPath,
        task: 'Test integrity',
        sha256,
        status: 'queued',
        queued_at: new Date().toISOString(),
      }],
    });

    // Modify the PRD after queueing
    fs.writeFileSync(prdPath, '# Modified PRD');

    const logs = [];
    const errs = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => errs.push(args.join(' '));

    try {
      const { main } = await import('../bin/jar-runner.js');
      await main([]);
    } finally {
      console.log = origLog;
      console.error = origErr;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const queue = readJarQueue();
    const task = queue.tasks.find(t => t.id === 'task-integ-1');
    assert.ok(task, 'task must exist in queue');
    assert.equal(task.status, 'integrity_failed', 'must be integrity_failed');
  });
});

describe('buildJarNotification', () => {
  it('reports success correctly', () => {
    const { title, body } = buildJarNotification(3, 0);
    assert.equal(title, 'Pickle Jar Complete');
    assert.equal(body, '3 tasks completed');
  });

  it('reports single task correctly', () => {
    const { title, body } = buildJarNotification(1, 0);
    assert.equal(body, '1 task completed');
  });

  it('reports failures correctly', () => {
    const { title, body } = buildJarNotification(2, 1);
    assert.equal(body, '2 succeeded, 1 failed');
  });

  it('reports all failed correctly', () => {
    const { title } = buildJarNotification(0, 3);
    assert.equal(title, 'Pickle Jar Failed');
  });
});
