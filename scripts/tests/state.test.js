import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readStateFile, writeStateFile, updateState, PROTECTED_KEYS, WRITABLE_KEYS } from '../bin/update-state.js';
import { VALID_STEPS } from '../bin/types/index.js';

/** Full 18-field State object for testing. */
function makeState(overrides = {}) {
  return {
    active: true,
    working_dir: '/tmp/test',
    step: 'prd',
    iteration: 0,
    max_iterations: 10,
    max_time_minutes: 60,
    worker_timeout_seconds: 300,
    start_time_epoch: 1700000000,
    completion_promise: null,
    original_prompt: 'test prompt',
    current_ticket: null,
    history: [],
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

function withTempSession(initialState, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickle-state-'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(initialState));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('readStateFile / writeStateFile', () => {
  it('round-trip preserves all 18 State fields', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickle-state-'));
    try {
      const original = makeState();
      writeStateFile(dir, original);
      const loaded = readStateFile(dir);
      assert.deepStrictEqual(loaded, original);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

describe('writeStateFile atomicity', () => {
  it('uses PID-temp + rename (no partial JSON observable)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickle-state-'));
    try {
      const state = makeState();
      writeStateFile(dir, state);
      // After write, state.json exists and no temp files remain
      const files = fs.readdirSync(dir);
      assert.ok(files.includes('state.json'));
      assert.ok(!files.some(f => f.includes('.tmp')), 'temp file should be cleaned up');
      // Content is valid JSON
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf-8'));
      assert.equal(parsed.active, true);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Step validation
// ---------------------------------------------------------------------------

describe('updateState step validation', () => {
  it('rejects step not in VALID_STEPS', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('step', 'invalid', dir),
        /Invalid step "invalid".*Must be one of/
      );
    });
  });

  it('accepts all 7 valid steps', () => {
    for (const step of VALID_STEPS) {
      withTempSession(makeState(), (dir) => {
        assert.doesNotThrow(() => updateState('step', step, dir));
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Protected keys
// ---------------------------------------------------------------------------

describe('updateState protected keys', () => {
  it('rejects write to "active"', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('active', 'false', dir),
        /Key "active" is protected/
      );
    });
  });

  it('rejects write to "completion_promise"', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('completion_promise', 'X', dir),
        /Key "completion_promise" is protected/
      );
    });
  });

  it('rejects write to "history"', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('history', '[]', dir),
        /Key "history" is protected/
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Numeric validation
// ---------------------------------------------------------------------------

describe('updateState numeric validation', () => {
  it('accepts valid numbers and stores as number', () => {
    withTempSession(makeState(), (dir) => {
      updateState('iteration', '5', dir);
      const state = readStateFile(dir);
      assert.strictEqual(state.iteration, 5);
      assert.strictEqual(typeof state.iteration, 'number');
    });
  });

  it('rejects non-numeric values', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('iteration', 'abc', dir),
        /Key "iteration" requires a finite number, got "abc"/
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Boolean validation
// ---------------------------------------------------------------------------

describe('updateState boolean validation', () => {
  it('accepts "true"/"false" and stores as boolean', () => {
    withTempSession(makeState(), (dir) => {
      updateState('chain_meeseeks', 'true', dir);
      const state = readStateFile(dir);
      assert.strictEqual(state.chain_meeseeks, true);
      assert.strictEqual(typeof state.chain_meeseeks, 'boolean');
    });
  });

  it('rejects non-boolean values', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('chain_meeseeks', 'yes', dir),
        /Key "chain_meeseeks" requires "true" or "false", got "yes"/
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Unknown key
// ---------------------------------------------------------------------------

describe('updateState unknown key', () => {
  it('rejects unknown key with allowed keys listed', () => {
    withTempSession(makeState(), (dir) => {
      assert.throws(
        () => updateState('foo', 'bar', dir),
        /Unknown key "foo".*Allowed keys:/
      );
    });
  });
});
