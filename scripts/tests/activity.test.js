import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  logActivity,
  pruneActivity,
  readActivityLogs,
  getActivityDir,
} from '../bin/services/activity-logger.js';
import { VALID_ACTIVITY_EVENTS } from '../bin/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'activity-test-'));
}

function withExtDir(tmpDir, fn) {
  const orig = process.env.EXTENSION_DIR;
  process.env.EXTENSION_DIR = tmpDir;
  try {
    return fn();
  } finally {
    if (orig === undefined) delete process.env.EXTENSION_DIR;
    else process.env.EXTENSION_DIR = orig;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('activity-logger', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('logActivity creates NDJSON with correct format', () => {
    withExtDir(tmpDir, () => {
      logActivity({ event: 'session_start', source: 'pickle', session: 'test-session' });

      const activityDir = path.join(tmpDir, 'activity');
      assert.ok(fs.existsSync(activityDir), 'activity dir must exist');

      const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.ndjson'));
      assert.ok(files.length > 0, 'must have at least one ndjson file');

      const content = fs.readFileSync(path.join(activityDir, files[0]), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      assert.ok(lines.length > 0, 'must have at least one line');

      for (const line of lines) {
        const parsed = JSON.parse(line);
        assert.ok(parsed, 'each line must be valid JSON');
      }
    });
  });

  it('events have required fields: ts, event, source, session', () => {
    withExtDir(tmpDir, () => {
      logActivity({ event: 'ticket_completed', source: 'hook', session: 'req-fields-test' });

      const activityDir = path.join(tmpDir, 'activity');
      const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.ndjson'));
      const content = fs.readFileSync(path.join(activityDir, files[0]), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      const lastLine = JSON.parse(lines[lines.length - 1]);

      assert.equal(typeof lastLine.ts, 'string', 'ts must be a string');
      assert.equal(typeof lastLine.event, 'string', 'event must be a string');
      assert.equal(typeof lastLine.source, 'string', 'source must be a string');
      assert.equal(lastLine.session, 'req-fields-test');
    });
  });

  it('activity log files have 0o600 permissions', () => {
    withExtDir(tmpDir, () => {
      const activityDir = path.join(tmpDir, 'activity');
      const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.ndjson'));
      assert.ok(files.length > 0);

      for (const file of files) {
        const stat = fs.statSync(path.join(activityDir, file));
        const mode = stat.mode & 0o777;
        assert.equal(mode, 0o600, `file ${file} must have 0o600, got 0o${mode.toString(8)}`);
      }
    });
  });

  it('VALID_ACTIVITY_EVENTS has 20 event types', () => {
    assert.equal(VALID_ACTIVITY_EVENTS.length, 20, 'must have 20 event types');
    assert.ok(!VALID_ACTIVITY_EVENTS.includes('invalid'), 'invalid must not be in event types');
  });

  it('pruneActivity deletes files >365 days old', () => {
    const pruneDir = makeTmpDir();
    try {
      withExtDir(pruneDir, () => {
        const activityDir = path.join(pruneDir, 'activity');
        fs.mkdirSync(activityDir, { recursive: true });

        const oldFile = path.join(activityDir, 'activity-2024-01-01.ndjson');
        fs.writeFileSync(oldFile, '{"ts":"2024-01-01T00:00:00Z","event":"session_start","source":"pickle"}\n');

        assert.ok(fs.existsSync(oldFile), 'old file must exist before pruning');
        const deleted = pruneActivity();
        assert.ok(deleted > 0, 'must delete at least one file');
        assert.ok(!fs.existsSync(oldFile), 'old file must be deleted');
      });
    } finally {
      fs.rmSync(pruneDir, { recursive: true, force: true });
    }
  });

  it('pruneActivity keeps recent files', () => {
    const pruneDir = makeTmpDir();
    try {
      withExtDir(pruneDir, () => {
        const activityDir = path.join(pruneDir, 'activity');
        fs.mkdirSync(activityDir, { recursive: true });

        const today = new Date().toLocaleDateString('en-CA');
        const recentFile = path.join(activityDir, `activity-${today}.ndjson`);
        fs.writeFileSync(recentFile, '{"ts":"2026-03-09T00:00:00Z","event":"session_start","source":"pickle"}\n');

        pruneActivity();
        assert.ok(fs.existsSync(recentFile), 'recent file must be kept');
      });
    } finally {
      fs.rmSync(pruneDir, { recursive: true, force: true });
    }
  });

  it('pruning uses filename date parsing, not mtime', () => {
    const pruneDir = makeTmpDir();
    try {
      withExtDir(pruneDir, () => {
        const activityDir = path.join(pruneDir, 'activity');
        fs.mkdirSync(activityDir, { recursive: true });

        // File with old filename but current mtime
        const oldNameFile = path.join(activityDir, 'activity-2023-06-15.ndjson');
        fs.writeFileSync(oldNameFile, '{"ts":"2023-06-15T00:00:00Z","event":"session_start","source":"pickle"}\n');

        pruneActivity();
        assert.ok(!fs.existsSync(oldNameFile), 'file with old filename must be deleted regardless of mtime');
      });
    } finally {
      fs.rmSync(pruneDir, { recursive: true, force: true });
    }
  });

  it('no-op when config.activity_logging is false', () => {
    const noopDir = makeTmpDir();
    try {
      withExtDir(noopDir, () => {
        const config = { defaults: { activity_logging: false } };
        logActivity({ event: 'session_start', source: 'pickle' }, config);

        const activityDir = path.join(noopDir, 'activity');
        if (fs.existsSync(activityDir)) {
          const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.ndjson'));
          assert.equal(files.length, 0, 'no files when logging disabled');
        }
      });
    } finally {
      fs.rmSync(noopDir, { recursive: true, force: true });
    }
  });

  it('readActivityLogs returns events sorted by timestamp', () => {
    const readDir = makeTmpDir();
    try {
      withExtDir(readDir, () => {
        const activityDir = path.join(readDir, 'activity');
        fs.mkdirSync(activityDir, { recursive: true });

        const today = new Date().toLocaleDateString('en-CA');
        const logFile = path.join(activityDir, `activity-${today}.ndjson`);
        const lines = [
          JSON.stringify({ ts: `${today}T10:00:00Z`, event: 'session_end', source: 'pickle' }),
          JSON.stringify({ ts: `${today}T08:00:00Z`, event: 'session_start', source: 'pickle' }),
          JSON.stringify({ ts: `${today}T09:00:00Z`, event: 'iteration_start', source: 'hook' }),
        ];
        fs.writeFileSync(logFile, lines.join('\n') + '\n', { mode: 0o600 });

        const since = new Date(`${today}T00:00:00`);
        const events = readActivityLogs(since);
        assert.equal(events.length, 3);
        assert.ok(events[0].ts <= events[1].ts, 'events must be sorted');
        assert.ok(events[1].ts <= events[2].ts, 'events must be sorted');
      });
    } finally {
      fs.rmSync(readDir, { recursive: true, force: true });
    }
  });
});
