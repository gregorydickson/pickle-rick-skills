import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Set EXTENSION_DIR to temp before importing
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-utils-test-'));
process.env.EXTENSION_DIR = tmpRoot;

const { validatePrdPath, addToJar, readJarQueue, writeJarQueue, verifyIntegrity, computeSha256, updateTaskStatus } =
  await import('../bin/services/jar-utils.js');

describe('validatePrdPath', () => {
  it('rejects paths containing ..', () => {
    assert.throws(() => validatePrdPath('../evil.md'), /path traversal detected/);
  });

  it('rejects deeply nested ..', () => {
    assert.throws(() => validatePrdPath('foo/../../evil.md'), /path traversal detected/);
  });

  it('rejects absolute paths outside cwd', () => {
    assert.throws(() => validatePrdPath('/etc/passwd'), /path traversal detected/);
  });

  it('rejects paths with null bytes', () => {
    assert.throws(() => validatePrdPath('file\x00.md'), /path traversal detected/);
  });

  it('accepts valid relative paths', () => {
    assert.doesNotThrow(() => validatePrdPath('prds/my-prd.md'));
  });

  it('accepts paths within cwd', () => {
    assert.doesNotThrow(() => validatePrdPath('docs/feature.md'));
  });
});

describe('SHA-256 integrity', () => {
  let tmpDir;
  let prdPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-sha-'));
    prdPath = path.join(tmpDir, 'test-prd.md');
    fs.writeFileSync(prdPath, '# Test PRD\nSome content here.');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('computeSha256 returns hex hash', () => {
    const hash = computeSha256(prdPath);
    assert.match(hash, /^[a-f0-9]{64}$/);
  });

  it('verifyIntegrity returns true for unchanged file', () => {
    const content = fs.readFileSync(prdPath, 'utf-8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const task = { id: 'test', prd_path: prdPath, sha256, task: 'test', status: 'queued', queued_at: new Date().toISOString() };
    assert.equal(verifyIntegrity(task), true);
  });

  it('verifyIntegrity returns false after file modification', () => {
    const content = fs.readFileSync(prdPath, 'utf-8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const task = { id: 'test', prd_path: prdPath, sha256, task: 'test', status: 'queued', queued_at: new Date().toISOString() };

    // Modify the file
    fs.writeFileSync(prdPath, '# Modified PRD\nDifferent content.');
    assert.equal(verifyIntegrity(task), false);
  });

  it('verifyIntegrity returns false for missing file', () => {
    const task = { id: 'test', prd_path: '/nonexistent/file.md', sha256: 'abc', task: 'test', status: 'queued', queued_at: new Date().toISOString() };
    assert.equal(verifyIntegrity(task), false);
  });
});

describe('queue operations', () => {
  let origDir;

  beforeEach(() => {
    origDir = process.env.EXTENSION_DIR;
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-queue-'));
    process.env.EXTENSION_DIR = testDir;
  });

  afterEach(() => {
    process.env.EXTENSION_DIR = origDir;
  });

  it('readJarQueue returns empty queue when no file exists', () => {
    const queue = readJarQueue();
    assert.deepEqual(queue, { tasks: [] });
  });

  it('writeJarQueue then readJarQueue roundtrips', () => {
    const queue = {
      tasks: [{
        id: 'abc123',
        prd_path: '/tmp/test.md',
        task: 'Test task',
        sha256: 'deadbeef',
        status: 'queued',
        queued_at: '2026-01-01T00:00:00.000Z',
      }],
    };
    writeJarQueue(queue);
    const read = readJarQueue();
    assert.deepEqual(read, queue);
  });
});

describe('updateTaskStatus', () => {
  let tmpDir;
  let origDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-update-'));
    origDir = process.env.EXTENSION_DIR;
    process.env.EXTENSION_DIR = tmpDir;
    writeJarQueue({
      tasks: [{
        id: 'task-abc',
        prd_path: '/tmp/prd.md',
        task: 'Test task',
        sha256: 'abc',
        status: 'queued',
        queued_at: '2026-01-01T00:00:00.000Z',
      }],
    });
  });

  afterEach(() => {
    process.env.EXTENSION_DIR = origDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates task status by id', () => {
    updateTaskStatus('task-abc', 'running');
    const queue = readJarQueue();
    const task = queue.tasks.find(t => t.id === 'task-abc');
    assert.equal(task.status, 'running');
  });

  it('applies optional field updates', () => {
    const startedAt = '2026-03-09T10:00:00.000Z';
    updateTaskStatus('task-abc', 'running', { started_at: startedAt, session_dir: '/tmp/session' });
    const queue = readJarQueue();
    const task = queue.tasks.find(t => t.id === 'task-abc');
    assert.equal(task.started_at, startedAt);
    assert.equal(task.session_dir, '/tmp/session');
  });

  it('silently ignores unknown task id', () => {
    assert.doesNotThrow(() => updateTaskStatus('nonexistent-id', 'completed'));
    const queue = readJarQueue();
    assert.equal(queue.tasks.length, 1);
    assert.equal(queue.tasks[0].status, 'queued');
  });

  it('transitions queued → completed with timestamp', () => {
    const completedAt = new Date().toISOString();
    updateTaskStatus('task-abc', 'completed', { completed_at: completedAt });
    const queue = readJarQueue();
    const task = queue.tasks.find(t => t.id === 'task-abc');
    assert.equal(task.status, 'completed');
    assert.equal(task.completed_at, completedAt);
  });
});

describe('addToJar', () => {
  let tmpDir;
  let origDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-add-'));
    origDir = process.env.EXTENSION_DIR;
    process.env.EXTENSION_DIR = tmpDir;
  });

  afterEach(() => {
    process.env.EXTENSION_DIR = origDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds task to queue with SHA-256 hash', () => {
    // Create a PRD file within cwd
    const prdPath = path.join(process.cwd(), 'test-add-prd.md');
    fs.writeFileSync(prdPath, '# Add Test PRD');
    try {
      const task = addToJar('test-add-prd.md', 'Test add task');
      assert.ok(task.id);
      assert.equal(task.task, 'Test add task');
      assert.equal(task.status, 'queued');
      assert.match(task.sha256, /^[a-f0-9]{64}$/);
      assert.ok(task.queued_at);

      const queue = readJarQueue();
      assert.equal(queue.tasks.length, 1);
      assert.equal(queue.tasks[0].id, task.id);
    } finally {
      fs.unlinkSync(prdPath);
    }
  });

  it('throws on path traversal in addToJar', () => {
    assert.throws(() => addToJar('../evil.md', 'Evil task'), /path traversal detected/);
  });
});
