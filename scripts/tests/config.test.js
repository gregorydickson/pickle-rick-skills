import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  validateConfig,
  getExtensionRoot,
  DEFAULT_CONFIG_DEFAULTS,
  ALL_DEFAULT_RUNTIMES,
  VERIFIED_RUNTIMES,
  PENDING_RUNTIMES,
  COMMUNITY_RUNTIMES,
} from '../bin/services/config.js';

describe('getExtensionRoot', () => {
  const original = process.env.EXTENSION_DIR;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXTENSION_DIR;
    } else {
      process.env.EXTENSION_DIR = original;
    }
  });

  it('returns default path when EXTENSION_DIR not set', () => {
    delete process.env.EXTENSION_DIR;
    assert.equal(getExtensionRoot(), path.join(os.homedir(), '.pickle-rick-skills'));
  });

  it('returns EXTENSION_DIR when set', () => {
    process.env.EXTENSION_DIR = '/tmp/test-extension';
    assert.equal(getExtensionRoot(), '/tmp/test-extension');
  });
});

describe('DEFAULT_CONFIG_DEFAULTS', () => {
  it('has exactly 20 keys', () => {
    assert.equal(Object.keys(DEFAULT_CONFIG_DEFAULTS).length, 20);
  });

  it('has correct default values', () => {
    assert.equal(DEFAULT_CONFIG_DEFAULTS.max_iterations, 100);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.max_time_minutes, 720);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.worker_timeout_seconds, 1200);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.manager_max_turns, 50);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.tmux_max_turns, 200);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.meeseeks_min_passes, 10);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.meeseeks_max_passes, 50);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.meeseeks_model, 'sonnet');
    assert.equal(DEFAULT_CONFIG_DEFAULTS.council_min_passes, 5);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.council_max_passes, 20);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.refinement_cycles, 3);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.refinement_max_turns, 100);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.circuit_breaker_enabled, true);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.cb_no_progress_threshold, 5);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.cb_same_error_threshold, 5);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.cb_half_open_after, 2);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.rate_limit_wait_minutes, 60);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.max_rate_limit_retries, 3);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.sigkill_grace_seconds, 5);
    assert.equal(DEFAULT_CONFIG_DEFAULTS.max_retries_per_ticket, 3);
  });
});

describe('Runtime Registry', () => {
  it('has 1 verified runtime', () => {
    assert.equal(Object.keys(VERIFIED_RUNTIMES).length, 1);
    assert.ok(VERIFIED_RUNTIMES.claude);
  });

  it('has 2 pending runtimes', () => {
    assert.equal(Object.keys(PENDING_RUNTIMES).length, 2);
    assert.ok(PENDING_RUNTIMES.gemini);
    assert.ok(PENDING_RUNTIMES.codex);
  });

  it('has 5 community runtimes', () => {
    assert.equal(Object.keys(COMMUNITY_RUNTIMES).length, 5);
    assert.ok(COMMUNITY_RUNTIMES.hermes);
    assert.ok(COMMUNITY_RUNTIMES.goose);
    assert.ok(COMMUNITY_RUNTIMES.amp);
    assert.ok(COMMUNITY_RUNTIMES.opencode);
    assert.ok(COMMUNITY_RUNTIMES.aider);
  });

  it('ALL_DEFAULT_RUNTIMES has all 8', () => {
    assert.equal(Object.keys(ALL_DEFAULT_RUNTIMES).length, 8);
  });

  it('each runtime has correct tier label', () => {
    assert.equal(ALL_DEFAULT_RUNTIMES.claude.tier, 'verified');
    assert.equal(ALL_DEFAULT_RUNTIMES.gemini.tier, 'pending');
    assert.equal(ALL_DEFAULT_RUNTIMES.codex.tier, 'pending');
    assert.equal(ALL_DEFAULT_RUNTIMES.hermes.tier, 'community');
    assert.equal(ALL_DEFAULT_RUNTIMES.goose.tier, 'community');
    assert.equal(ALL_DEFAULT_RUNTIMES.amp.tier, 'community');
    assert.equal(ALL_DEFAULT_RUNTIMES.opencode.tier, 'community');
    assert.equal(ALL_DEFAULT_RUNTIMES.aider.tier, 'community');
  });
});

describe('loadConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickle-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads empty config file and fills all 20 defaults', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, '{}');
    const config = loadConfig(configPath);

    assert.equal(config.defaults.max_iterations, 100);
    assert.equal(config.defaults.tmux_max_turns, 200);
    assert.equal(config.defaults.manager_max_turns, 50);
    assert.equal(config.defaults.worker_timeout_seconds, 1200);
    assert.equal(config.defaults.cb_no_progress_threshold, 5);
    assert.equal(Object.keys(config.defaults).length, 20);
  });

  it('merges partial config with defaults', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ primary_cli: 'gemini' }));
    const config = loadConfig(configPath);

    assert.equal(config.primary_cli, 'gemini');
    assert.equal(config.defaults.max_iterations, 100);
    assert.equal(config.defaults.tmux_max_turns, 200);
    assert.equal(config.persona, true);
    assert.equal(config.activity_logging, true);
  });

  it('uses defaults when config file does not exist', () => {
    const configPath = path.join(tmpDir, 'nonexistent.json');
    const config = loadConfig(configPath);

    assert.equal(config.primary_cli, 'claude');
    assert.equal(config.defaults.max_iterations, 100);
    assert.equal(Object.keys(config.runtimes).length, 8);
  });

  it('user overrides merge with defaults', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      defaults: { max_iterations: 50 },
    }));
    const config = loadConfig(configPath);

    assert.equal(config.defaults.max_iterations, 50);
    assert.equal(config.defaults.tmux_max_turns, 200);
  });

  it('tmux_max_turns is primary (200), manager_max_turns is fallback (50)', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, '{}');
    const config = loadConfig(configPath);

    // mux-runner resolves to tmux_max_turns
    assert.equal(config.defaults.tmux_max_turns, 200);
    // jar-runner resolves to manager_max_turns
    assert.equal(config.defaults.manager_max_turns, 50);
    assert.ok(config.defaults.tmux_max_turns > config.defaults.manager_max_turns);
  });

  it('includes all 8 default runtimes', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, '{}');
    const config = loadConfig(configPath);

    const names = Object.keys(config.runtimes);
    assert.equal(names.length, 8);
    for (const name of ['claude', 'gemini', 'codex', 'hermes', 'goose', 'amp', 'opencode', 'aider']) {
      assert.ok(names.includes(name), `Missing runtime: ${name}`);
    }
  });
});

describe('validateConfig', () => {
  function makeConfig(overrides = {}) {
    return {
      primary_cli: 'claude',
      runtimes: { ...ALL_DEFAULT_RUNTIMES },
      defaults: { ...DEFAULT_CONFIG_DEFAULTS, ...overrides },
      persona: true,
      activity_logging: true,
    };
  }

  it('accepts valid config', () => {
    assert.doesNotThrow(() => validateConfig(makeConfig()));
  });

  it('throws on cb_no_progress_threshold < 2', () => {
    assert.throws(
      () => validateConfig(makeConfig({ cb_no_progress_threshold: 1 })),
      /cb_no_progress_threshold must be >= 2/,
    );
  });

  it('throws on cb_same_error_threshold < 2', () => {
    assert.throws(
      () => validateConfig(makeConfig({ cb_same_error_threshold: 1 })),
      /cb_same_error_threshold must be >= 2/,
    );
  });

  it('throws on cb_half_open_after >= cb_no_progress_threshold', () => {
    assert.throws(
      () => validateConfig(makeConfig({ cb_half_open_after: 5, cb_no_progress_threshold: 5 })),
      /cb_half_open_after.*must be < cb_no_progress_threshold/,
    );
  });

  it('throws on invalid primary_cli', () => {
    const config = makeConfig();
    // @ts-ignore — intentional bad value for test
    config.primary_cli = 'invalid_cli';
    assert.throws(
      () => validateConfig(config),
      /Invalid primary_cli/,
    );
  });
});
