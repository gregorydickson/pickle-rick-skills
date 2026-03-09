import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import compiled modules — tests run against scripts/bin/
import {
  classifyCompletion,
  classifyIterationExit,
  validateCommandTemplate,
  transitionToMeeseeks,
  isDegenerate,
} from '../../scripts/bin/mux-runner.js';

import { hasToken, PromiseTokens } from '../../scripts/bin/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'loop-test-'));
}

function makeState(overrides = {}) {
  return {
    active: true,
    working_dir: '/tmp/test',
    step: 'implement',
    iteration: 1,
    max_iterations: 100,
    max_time_minutes: 120,
    worker_timeout_seconds: 1200,
    start_time_epoch: Date.now(),
    completion_promise: null,
    original_prompt: 'Test task',
    current_ticket: 'test-001',
    history: [],
    started_at: new Date().toISOString(),
    session_dir: '/tmp/test-session',
    tmux_mode: false,
    chain_meeseeks: false,
    runtime: 'claude',
    ...overrides,
  };
}

function writeState(dir, state) {
  const p = path.join(dir, 'state.json');
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
  return p;
}

function readState(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf-8'));
}

// ---------------------------------------------------------------------------
// Promise Token Detection
// ---------------------------------------------------------------------------

describe('promise token detection', () => {
  it('detects TASK_COMPLETED token', () => {
    const output = 'Some output\n<promise>TASK_COMPLETED</promise>\nMore output';
    assert.ok(hasToken(output, PromiseTokens.TASK_COMPLETED));
  });

  it('detects EPIC_COMPLETED token', () => {
    const output = '<promise>EPIC_COMPLETED</promise>';
    assert.ok(hasToken(output, PromiseTokens.EPIC_COMPLETED));
  });

  it('detects I AM DONE token', () => {
    const output = '<promise>I AM DONE</promise>';
    assert.ok(hasToken(output, PromiseTokens.WORKER_DONE));
  });

  it('rejects missing token', () => {
    const output = 'No promise tokens here';
    assert.ok(!hasToken(output, PromiseTokens.TASK_COMPLETED));
  });

  it('rejects bare token without promise tags', () => {
    const output = 'TASK_COMPLETED';
    assert.ok(!hasToken(output, PromiseTokens.TASK_COMPLETED));
  });

  it('handles whitespace in promise tags', () => {
    const output = '<promise> TASK_COMPLETED </promise>';
    assert.ok(hasToken(output, PromiseTokens.TASK_COMPLETED));
  });
});

// ---------------------------------------------------------------------------
// Completion Classification
// ---------------------------------------------------------------------------

describe('classifyCompletion', () => {
  it('classifies TASK_COMPLETED as task_completed', () => {
    const output = 'Done!\n<promise>TASK_COMPLETED</promise>';
    assert.equal(classifyCompletion(output), 'task_completed');
  });

  it('classifies EPIC_COMPLETED as task_completed', () => {
    const output = '<promise>EPIC_COMPLETED</promise>';
    assert.equal(classifyCompletion(output), 'task_completed');
  });

  it('classifies EXISTENCE_IS_PAIN as review_clean', () => {
    const output = '<promise>EXISTENCE_IS_PAIN</promise>';
    assert.equal(classifyCompletion(output), 'review_clean');
  });

  it('classifies THE_CITADEL_APPROVES as review_clean', () => {
    const output = '<promise>THE_CITADEL_APPROVES</promise>';
    assert.equal(classifyCompletion(output), 'review_clean');
  });

  it('classifies PRD_COMPLETE as continue', () => {
    const output = '<promise>PRD_COMPLETE</promise>';
    assert.equal(classifyCompletion(output), 'continue');
  });

  it('classifies TICKET_SELECTED as continue', () => {
    const output = '<promise>TICKET_SELECTED</promise>';
    assert.equal(classifyCompletion(output), 'continue');
  });

  it('classifies no tokens as continue', () => {
    assert.equal(classifyCompletion('just some output'), 'continue');
  });

  it('respects priority: EPIC_COMPLETED > TASK_COMPLETED', () => {
    const output = '<promise>TASK_COMPLETED</promise>\n<promise>EPIC_COMPLETED</promise>';
    assert.equal(classifyCompletion(output), 'task_completed');
  });

  it('matches custom completion_promise from state', () => {
    const output = '<promise>CUSTOM_DONE</promise>';
    const state = makeState({ completion_promise: 'CUSTOM_DONE' });
    assert.equal(classifyCompletion(output, state), 'task_completed');
  });
});

// ---------------------------------------------------------------------------
// Iteration Exit Classification
// ---------------------------------------------------------------------------

describe('classifyIterationExit', () => {
  it('classifies exit code 0 as success', () => {
    const result = classifyIterationExit(0, 'ok', '', false);
    assert.equal(result.type, 'success');
  });

  it('classifies non-zero exit as error', () => {
    const result = classifyIterationExit(1, '', 'error', false);
    assert.equal(result.type, 'error');
  });

  it('classifies timeout as error', () => {
    const result = classifyIterationExit(null, '', '', true);
    assert.equal(result.type, 'error');
  });

  it('detects rate limit from JSON event', () => {
    const stdout = '{"type":"rate_limit_event","status":"rejected","rateLimitType":"five_hour"}\n';
    const result = classifyIterationExit(0, stdout, '', false);
    assert.equal(result.type, 'api_limit');
  });

  it('rate limit takes priority over error exit', () => {
    const stderr = '{"type":"rate_limit_event","status":"rejected"}\n';
    const result = classifyIterationExit(1, '', stderr, false);
    assert.equal(result.type, 'api_limit');
  });
});

// ---------------------------------------------------------------------------
// Degenerate Output Detection
// ---------------------------------------------------------------------------

describe('degenerate detection', () => {
  it('detects whitespace-only output', () => {
    const result = isDegenerate('   \n\n  ');
    assert.ok(result.degenerate, 'whitespace-only should be degenerate');
    assert.equal(result.reason, 'whitespace_only');
  });

  it('detects no-op phrase', () => {
    const result = isDegenerate('ok');
    assert.ok(result.degenerate, '"ok" should be degenerate');
    assert.equal(result.reason, 'no_op_phrase');
  });

  it('detects ultra-short output', () => {
    const result = isDegenerate('hi');
    assert.ok(result.degenerate, 'ultra-short should be degenerate');
    assert.equal(result.reason, 'ultra_short');
  });

  it('does not flag varied output as degenerate', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: unique content`);
    const result = isDegenerate(lines.join('\n'));
    assert.ok(!result.degenerate, 'varied output should not be degenerate');
  });
});

// ---------------------------------------------------------------------------
// Command Template Validation
// ---------------------------------------------------------------------------

describe('validateCommandTemplate', () => {
  it('accepts valid template names', () => {
    assert.doesNotThrow(() => validateCommandTemplate('pickle-rick'));
    assert.doesNotThrow(() => validateCommandTemplate('meeseeks'));
  });

  it('rejects path traversal', () => {
    assert.throws(() => validateCommandTemplate('../evil'), /path separators/);
    assert.throws(() => validateCommandTemplate('foo/bar'), /path separators/);
  });
});

// ---------------------------------------------------------------------------
// State Round-Trip
// ---------------------------------------------------------------------------

describe('state round-trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists state across write/read cycles', () => {
    const state = makeState({ iteration: 1, step: 'prd' });
    writeState(tmpDir, state);

    const loaded = readState(tmpDir);
    assert.equal(loaded.iteration, 1);
    assert.equal(loaded.step, 'prd');
    assert.equal(loaded.active, true);
    assert.equal(loaded.runtime, 'claude');
  });

  it('updates state between iterations', () => {
    const state = makeState({ iteration: 0 });
    writeState(tmpDir, state);

    // Simulate iteration advancement
    const loaded = readState(tmpDir);
    loaded.iteration = 1;
    loaded.step = 'implement';
    loaded.history.push({ step: 'prd', timestamp: new Date().toISOString() });
    writeState(tmpDir, loaded);

    const updated = readState(tmpDir);
    assert.equal(updated.iteration, 1);
    assert.equal(updated.step, 'implement');
    assert.equal(updated.history.length, 1);
  });

  it('maintains all required fields through round-trip', () => {
    const state = makeState();
    writeState(tmpDir, state);

    const loaded = readState(tmpDir);
    const requiredFields = [
      'active', 'working_dir', 'step', 'iteration', 'max_iterations',
      'max_time_minutes', 'worker_timeout_seconds', 'start_time_epoch',
      'completion_promise', 'original_prompt', 'current_ticket', 'history',
      'started_at', 'session_dir', 'runtime',
    ];
    for (const field of requiredFields) {
      assert.ok(field in loaded, `loaded state should have field "${field}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Meeseeks Transition
// ---------------------------------------------------------------------------

describe('transitionToMeeseeks', () => {
  it('sets step to review and resets iteration', () => {
    const state = makeState({ step: 'implement', iteration: 5 });
    const next = transitionToMeeseeks(state);

    assert.equal(next.step, 'review');
    assert.equal(next.iteration, 0);
    assert.equal(next.chain_meeseeks, false);
  });

  it('preserves session_dir and working_dir', () => {
    const state = makeState({ session_dir: '/test/session', working_dir: '/test/work' });
    const next = transitionToMeeseeks(state);

    assert.equal(next.session_dir, '/test/session');
    assert.equal(next.working_dir, '/test/work');
  });
});
