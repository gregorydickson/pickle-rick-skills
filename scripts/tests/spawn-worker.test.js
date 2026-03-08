import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpawnCommand,
  buildManagerSpawnCommand,
  buildWorkerSpawnCommand,
  resolveRuntime,
  formatDryRun,
  listRuntimes,
} from '../bin/services/runtime-adapter.js';
import { loadConfig, ALL_DEFAULT_RUNTIMES } from '../bin/services/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeConfig(overrides = {}) {
  return {
    primary_cli: 'claude',
    runtimes: { ...ALL_DEFAULT_RUNTIMES },
    defaults: {
      max_iterations: 100, max_time_minutes: 720, worker_timeout_seconds: 1200,
      manager_max_turns: 50, tmux_max_turns: 200, meeseeks_min_passes: 10,
      meeseeks_max_passes: 50, meeseeks_model: 'sonnet', council_min_passes: 5,
      council_max_passes: 20, refinement_cycles: 3, refinement_max_turns: 100,
      circuit_breaker_enabled: true, cb_no_progress_threshold: 5,
      cb_same_error_threshold: 5, cb_half_open_after: 2,
      rate_limit_wait_minutes: 60, max_rate_limit_retries: 3,
      sigkill_grace_seconds: 5, max_retries_per_ticket: 3,
    },
    persona: true,
    activity_logging: true,
    ...overrides,
  };
}

function makeManagerArgs(overrides = {}) {
  return {
    prompt: 'do the thing',
    runtime: 'claude',
    cwd: '/tmp/work',
    logFile: '/tmp/log.txt',
    timeout: 1200,
    sessionDir: '/tmp/session',
    extensionRoot: '/tmp/extension',
    maxTurns: 200,
    env: {
      set: { PICKLE_STATE_FILE: '/tmp/state.json', PYTHONUNBUFFERED: '1' },
      delete: ['CLAUDECODE', 'PICKLE_ROLE'],
    },
    ...overrides,
  };
}

function makeWorkerArgs(overrides = {}) {
  return {
    prompt: 'implement ticket',
    runtime: 'claude',
    cwd: '/tmp/work',
    logFile: '/tmp/log.txt',
    timeout: 1200,
    ticketPath: '/tmp/session/abc123',
    extensionRoot: '/tmp/extension',
    env: {
      set: { PICKLE_STATE_FILE: '/tmp/state.json', PICKLE_ROLE: 'worker', PYTHONUNBUFFERED: '1' },
      delete: ['CLAUDECODE'],
    },
    ...overrides,
  };
}

describe('resolveRuntime', () => {
  it('resolves known runtime', () => {
    const config = makeConfig();
    const runtime = resolveRuntime('claude', config);
    assert.equal(runtime.bin, 'claude');
    assert.equal(runtime.tier, 'verified');
  });

  it('throws on unknown runtime with available list', () => {
    const config = makeConfig();
    assert.throws(
      () => resolveRuntime('nonexistent', config),
      /Unknown runtime "nonexistent".*Available:/,
    );
  });
});

describe('buildManagerSpawnCommand', () => {
  it('builds correct claude manager command', () => {
    const config = makeConfig();
    const args = makeManagerArgs();
    const cmd = buildManagerSpawnCommand('claude', config, args);

    assert.deepEqual(cmd, [
      'claude', '-p', 'do the thing',
      '--dangerously-skip-permissions', '--no-session-persistence',
      '--add-dir', '/tmp/extension',
      '--add-dir', '/tmp/session',
      '--max-turns', '200',
      '--output-format', 'stream-json',
      '--verbose',
    ]);
  });

  it('includes model flag when model is provided', () => {
    const config = makeConfig();
    const args = makeManagerArgs({ model: 'opus' });
    const cmd = buildManagerSpawnCommand('claude', config, args);

    const modelIdx = cmd.indexOf('--model');
    assert.ok(modelIdx !== -1);
    assert.equal(cmd[modelIdx + 1], 'opus');
  });

  it('omits model flag when model is undefined', () => {
    const config = makeConfig();
    const args = makeManagerArgs();
    const cmd = buildManagerSpawnCommand('claude', config, args);

    assert.ok(!cmd.includes('--model'));
  });
});

describe('buildWorkerSpawnCommand', () => {
  it('builds correct claude worker command', () => {
    const config = makeConfig();
    const args = makeWorkerArgs();
    const cmd = buildWorkerSpawnCommand('claude', config, args);

    assert.deepEqual(cmd, [
      'claude', '-p', 'implement ticket',
      '--dangerously-skip-permissions', '--no-session-persistence',
      '--add-dir', '/tmp/extension',
      '--add-dir', '/tmp/session/abc123',
    ]);
  });

  it('builds correct codex worker command', () => {
    const config = makeConfig();
    const args = makeWorkerArgs({ runtime: 'codex', prompt: 'implement ticket' });
    const cmd = buildWorkerSpawnCommand('codex', config, args);

    assert.deepEqual(cmd, [
      'codex', 'exec', 'implement ticket', '--full-auto',
    ]);
  });

  it('handles hermes multi-word prompt_flag', () => {
    const config = makeConfig();
    const args = makeWorkerArgs({ runtime: 'hermes' });
    const cmd = buildWorkerSpawnCommand('hermes', config, args);

    assert.equal(cmd[0], 'hermes');
    assert.equal(cmd[1], 'chat');
    assert.equal(cmd[2], '-q');
    assert.equal(cmd[3], 'implement ticket');
  });
});

describe('buildSpawnCommand (generic)', () => {
  it('delegates to manager builder for SpawnManagerArgs', () => {
    const config = makeConfig();
    const args = makeManagerArgs();
    const cmd = buildSpawnCommand('claude', config, args);

    assert.ok(cmd.includes('--max-turns'));
    assert.ok(cmd.includes('--verbose'));
  });

  it('delegates to worker builder for SpawnWorkerArgs', () => {
    const config = makeConfig();
    const args = makeWorkerArgs();
    const cmd = buildSpawnCommand('claude', config, args);

    assert.ok(!cmd.includes('--max-turns'));
    assert.ok(!cmd.includes('--verbose'));
  });
});

describe('all 8 runtimes produce valid commands', () => {
  const runtimeNames = ['claude', 'gemini', 'codex', 'hermes', 'goose', 'amp', 'opencode', 'aider'];

  for (const name of runtimeNames) {
    it(`${name} produces non-empty worker command`, () => {
      const config = makeConfig();
      const args = makeWorkerArgs({ runtime: name });
      const cmd = buildWorkerSpawnCommand(name, config, args);

      assert.ok(cmd.length > 0, `${name} produced empty command`);
      assert.equal(cmd[0], ALL_DEFAULT_RUNTIMES[name].bin);
    });
  }
});

describe('null flags omitted', () => {
  it('gemini command has no --add-dir (add_dir_flag is null)', () => {
    const config = makeConfig();
    const args = makeWorkerArgs({ runtime: 'gemini' });
    const cmd = buildWorkerSpawnCommand('gemini', config, args);

    assert.ok(!cmd.includes('--add-dir'));
  });

  it('hermes command has no --max-turns (max_turns_flag is null)', () => {
    const config = makeConfig();
    const args = makeManagerArgs({ runtime: 'hermes' });
    const cmd = buildManagerSpawnCommand('hermes', config, args);

    assert.ok(!cmd.includes('--max-turns'));
  });

  it('aider command has no --verbose (verbose_flag is null)', () => {
    const config = makeConfig();
    const args = makeManagerArgs({ runtime: 'aider' });
    const cmd = buildManagerSpawnCommand('aider', config, args);

    assert.ok(!cmd.includes('--verbose'));
  });
});

describe('formatDryRun', () => {
  it('formats command array as string', () => {
    const result = formatDryRun(['claude', '-p', 'do the thing', '--verbose']);
    assert.equal(result, "claude -p 'do the thing' --verbose");
  });

  it('quotes arguments with spaces', () => {
    const result = formatDryRun(['bin', 'arg with spaces']);
    assert.ok(result.includes("'arg with spaces'"));
  });
});

describe('listRuntimes', () => {
  it('lists all runtimes with tiers', () => {
    const config = makeConfig();
    const output = listRuntimes(config);

    assert.ok(output.includes('claude (verified)'));
    assert.ok(output.includes('gemini (pending)'));
    assert.ok(output.includes('hermes (community)'));
    assert.ok(output.includes('codex (pending)'));
    assert.ok(output.includes('goose (community)'));
    assert.ok(output.includes('amp (community)'));
    assert.ok(output.includes('opencode (community)'));
    assert.ok(output.includes('aider (community)'));
  });

  it('shows detected status', () => {
    const config = makeConfig();
    const output = listRuntimes(config);

    assert.ok(output.includes('not detected'));
  });
});
