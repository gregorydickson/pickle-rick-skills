import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectRateLimitJSON,
  detectRateLimitText,
  classifyIterationExit,
  writeRateLimitWaitFile,
  clearRateLimitWaitFile,
  calculateWaitTime,
  cancellableWait,
} from '../bin/services/rate-limit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-'));
}

function makeState(overrides = {}) {
  return {
    active: true,
    working_dir: '/tmp/test',
    step: 'implement',
    iteration: 0,
    max_iterations: 100,
    max_time_minutes: 120,
    worker_timeout_seconds: 1200,
    start_time_epoch: Math.floor(Date.now() / 1000),
    completion_promise: null,
    original_prompt: 'test',
    current_ticket: null,
    history: [],
    started_at: new Date().toISOString(),
    session_dir: '/tmp/session',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Text Pattern Detection (5 regexes)
// ---------------------------------------------------------------------------

describe('detectRateLimitText', () => {
  it('detects "5 hour limit" pattern', () => {
    assert.equal(detectRateLimitText('You have reached your 5 hour limit'), true);
  });

  it('detects "limit reached try back" pattern', () => {
    assert.equal(detectRateLimitText('Rate limit reached, try coming back later'), true);
  });

  it('detects "usage limit reached" pattern', () => {
    assert.equal(detectRateLimitText('Your usage limit has been reached'), true);
  });

  it('detects "rate limit" pattern (case-insensitive)', () => {
    assert.equal(detectRateLimitText('Rate Limit exceeded'), true);
  });

  it('detects "out of usage" pattern', () => {
    assert.equal(detectRateLimitText('You are out of usage'), true);
  });

  it('detects "out of extra usage" pattern', () => {
    assert.equal(detectRateLimitText('You are out of extra usage'), true);
  });

  it('returns false for normal output', () => {
    assert.equal(detectRateLimitText('All tasks completed successfully'), false);
  });
});

// ---------------------------------------------------------------------------
// JSON Event Detection
// ---------------------------------------------------------------------------

describe('detectRateLimitJSON', () => {
  it('parses rate_limit_event with rejected status', () => {
    const json = JSON.stringify({
      type: 'rate_limit_event',
      status: 'rejected',
      resetsAt: 1234567890,
      rateLimitType: 'five_hour',
    });
    const result = detectRateLimitJSON(json);
    assert.notEqual(result, null);
    assert.equal(result.limited, true);
    assert.equal(result.resetsAt, 1234567890);
    assert.equal(result.rateLimitType, 'five_hour');
  });

  it('parses rate_limit_event with nested rate_limit_info', () => {
    const json = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'rejected',
        resetsAt: 9999999999,
        rateLimitType: 'seven_day',
      },
    });
    const result = detectRateLimitJSON(json);
    assert.notEqual(result, null);
    assert.equal(result.limited, true);
    assert.equal(result.resetsAt, 9999999999);
    assert.equal(result.rateLimitType, 'seven_day');
  });

  it('returns null for non-rate-limit JSON', () => {
    const json = JSON.stringify({ type: 'tool_use', name: 'bash' });
    assert.equal(detectRateLimitJSON(json), null);
  });

  it('returns null for non-JSON text', () => {
    assert.equal(detectRateLimitJSON('just some text output'), null);
  });

  it('handles malformed JSON gracefully', () => {
    assert.equal(detectRateLimitJSON('{ broken json !!!'), null);
  });

  it('finds rate_limit_event among multiple lines', () => {
    const lines = [
      JSON.stringify({ type: 'tool_use', name: 'read' }),
      'some text',
      JSON.stringify({ type: 'rate_limit_event', status: 'rejected', resetsAt: 1111 }),
      'more text',
    ].join('\n');
    const result = detectRateLimitJSON(lines);
    assert.notEqual(result, null);
    assert.equal(result.limited, true);
  });
});

// ---------------------------------------------------------------------------
// Wait File Creation (7 fields)
// ---------------------------------------------------------------------------

describe('writeRateLimitWaitFile / clearRateLimitWaitFile', () => {
  let tmpDir;

  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('writes rate_limit_wait.json with all 7+1 fields', () => {
    const info = {
      waiting: true,
      reason: 'API rate limit hit',
      started_at: '2026-03-08T12:00:00.000Z',
      wait_until: '2026-03-08T13:00:00.000Z',
      consecutive_waits: 1,
      rate_limit_type: 'five_hour',
      resets_at_epoch: 1234567890,
      wait_source: 'api',
    };
    writeRateLimitWaitFile(tmpDir, info);
    const filePath = path.join(tmpDir, 'rate_limit_wait.json');
    assert.ok(fs.existsSync(filePath));
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(data.waiting, true);
    assert.equal(data.reason, 'API rate limit hit');
    assert.equal(data.started_at, '2026-03-08T12:00:00.000Z');
    assert.equal(data.wait_until, '2026-03-08T13:00:00.000Z');
    assert.equal(data.consecutive_waits, 1);
    assert.equal(data.rate_limit_type, 'five_hour');
    assert.equal(data.resets_at_epoch, 1234567890);
    assert.equal(data.wait_source, 'api');
  });

  it('clearRateLimitWaitFile removes the file', () => {
    const info = {
      waiting: true,
      reason: 'test',
      started_at: new Date().toISOString(),
      wait_until: new Date().toISOString(),
      consecutive_waits: 0,
      rate_limit_type: 'unknown',
      resets_at_epoch: 0,
      wait_source: 'config',
    };
    writeRateLimitWaitFile(tmpDir, info);
    assert.ok(fs.existsSync(path.join(tmpDir, 'rate_limit_wait.json')));
    clearRateLimitWaitFile(tmpDir);
    assert.ok(!fs.existsSync(path.join(tmpDir, 'rate_limit_wait.json')));
  });

  it('clearRateLimitWaitFile is safe when file does not exist', () => {
    assert.doesNotThrow(() => clearRateLimitWaitFile(tmpDir));
  });
});

// ---------------------------------------------------------------------------
// Consecutive Retry Gate
// ---------------------------------------------------------------------------

describe('consecutive retry gate (classifyIterationExit)', () => {
  it('classifies rate-limited output as api_limit', () => {
    const state = makeState();
    const result = classifyIterationExit(0, 'rate limit exceeded', state);
    assert.equal(result.type, 'api_limit');
  });

  it('classifies normal output as success', () => {
    const state = makeState();
    const result = classifyIterationExit(0, 'all good output here', state);
    assert.equal(result.type, 'success');
  });

  it('classifies non-zero exit as error', () => {
    const state = makeState();
    const result = classifyIterationExit(1, 'crash happened', state);
    assert.equal(result.type, 'error');
  });

  it('classifies inactive state as inactive', () => {
    const state = makeState({ active: false });
    const result = classifyIterationExit(0, 'output', state);
    assert.equal(result.type, 'inactive');
  });

  it('rate limit takes priority over non-zero exit', () => {
    const state = makeState();
    const result = classifyIterationExit(1, 'rate limit exceeded', state);
    assert.equal(result.type, 'api_limit');
  });
});

// ---------------------------------------------------------------------------
// CB Poisoning Prevention
// ---------------------------------------------------------------------------

describe('CB poisoning prevention', () => {
  it('api_limit result does NOT count as error', () => {
    const state = makeState();
    const result = classifyIterationExit(0, 'You have reached your 5 hour limit', state);
    assert.equal(result.type, 'api_limit');
    assert.notEqual(result.type, 'error');
  });

  it('api_limit from JSON does NOT count as error', () => {
    const json = JSON.stringify({ type: 'rate_limit_event', status: 'rejected', resetsAt: 9999 });
    const state = makeState();
    const result = classifyIterationExit(0, json, state);
    assert.equal(result.type, 'api_limit');
    assert.ok(result.rateLimitInfo);
    assert.equal(result.rateLimitInfo.limited, true);
  });
});

// ---------------------------------------------------------------------------
// Wait Time Calculation
// ---------------------------------------------------------------------------

describe('calculateWaitTime', () => {
  it('uses API resetsAt with 30s buffer', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetsAt = now + 600; // 10 minutes from now
    const result = calculateWaitTime(resetsAt, 60);
    // Should be ~600s + 30s buffer = ~630s in ms
    const expected = (resetsAt - now + 30) * 1000;
    // Allow 2s tolerance for test execution time
    assert.ok(Math.abs(result - expected) < 2000);
  });

  it('caps at 3x config minutes + 30s buffer', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetsAt = now + 999999; // way in the future
    const configMinutes = 60;
    const result = calculateWaitTime(resetsAt, configMinutes);
    const maxMs = (3 * configMinutes * 60 + 30) * 1000;
    assert.ok(result <= maxMs);
  });

  it('uses config fallback when resetsAt is undefined', () => {
    const configMinutes = 60;
    const result = calculateWaitTime(undefined, configMinutes);
    const expected = configMinutes * 60 * 1000;
    assert.equal(result, expected);
  });

  it('uses config fallback when resetsAt is in the past', () => {
    const pastEpoch = Math.floor(Date.now() / 1000) - 3600;
    const configMinutes = 60;
    const result = calculateWaitTime(pastEpoch, configMinutes);
    assert.equal(result, configMinutes * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Cancellable Wait
// ---------------------------------------------------------------------------

describe('cancellableWait', () => {
  let tmpDir;

  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('returns false when state.active becomes false', async () => {
    const stateFile = path.join(tmpDir, 'state.json');
    fs.writeFileSync(stateFile, JSON.stringify({ active: true }));

    // Deactivate after 50ms
    setTimeout(() => {
      fs.writeFileSync(stateFile, JSON.stringify({ active: false }));
    }, 50);

    const result = await cancellableWait(tmpDir, 60_000, stateFile);
    assert.equal(result, false);
  });

  it('returns true when wait time elapses', async () => {
    const stateFile = path.join(tmpDir, 'state2.json');
    fs.writeFileSync(stateFile, JSON.stringify({ active: true }));

    // Very short wait — should complete
    const result = await cancellableWait(tmpDir, 50, stateFile);
    assert.equal(result, true);
  });
});
