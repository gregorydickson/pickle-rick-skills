import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const NODE_DIR = path.dirname(process.execPath);

const SKILL_NAMES = [
  'council-of-ricks', 'meeseeks', 'pickle-jar', 'pickle-metrics', 'pickle-prd',
  'pickle-refine-prd', 'pickle-rick', 'pickle-standup', 'portal-gun', 'project-mayhem',
];

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
}

function runInstall(tmpHome, extraArgs = '') {
  const env = {
    ...process.env,
    PICKLE_RICK_SKILLS_HOME: path.join(tmpHome, '.pickle-rick-skills'),
    AGENTS_SKILLS_HOME: path.join(tmpHome, '.agents', 'skills'),
    PATH: process.env.PATH,
  };
  return execSync(
    `bash "${PROJECT_ROOT}/install.sh" --skip-auth ${extraArgs}`,
    { env, cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30_000 },
  );
}

function runUninstall(tmpHome, extraArgs = '') {
  const env = {
    ...process.env,
    PICKLE_RICK_SKILLS_HOME: path.join(tmpHome, '.pickle-rick-skills'),
    AGENTS_SKILLS_HOME: path.join(tmpHome, '.agents', 'skills'),
  };
  return execSync(
    `bash "${PROJECT_ROOT}/uninstall.sh" --force ${extraArgs}`,
    { env, cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30_000 },
  );
}

function readConfig(tmpHome) {
  const p = path.join(tmpHome, '.pickle-rick-skills', 'config.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('install.sh', () => {
  let tmpHome;

  beforeEach(() => {
    tmpHome = makeTmpHome();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('writes config.json with all defaults', () => {
    runInstall(tmpHome);
    const config = readConfig(tmpHome);

    assert.ok(config.primary_cli, 'primary_cli should be set');
    assert.ok(config.defaults, 'defaults should exist');
    assert.ok(config.runtimes, 'runtimes should exist');

    // All 21 default keys present
    const expectedKeys = [
      'max_iterations', 'max_time_minutes', 'worker_timeout_seconds',
      'tmux_max_turns', 'manager_max_turns', 'refinement_cycles',
      'refinement_max_turns', 'refinement_worker_timeout_seconds',
      'meeseeks_min_passes', 'meeseeks_max_passes', 'meeseeks_model',
      'rate_limit_wait_minutes', 'max_rate_limit_retries', 'rate_limit_poll_ms',
      'sigkill_grace_seconds', 'cb_enabled', 'cb_no_progress_threshold',
      'cb_half_open_after', 'cb_error_threshold', 'chain_meeseeks',
      'activity_logging',
    ];
    for (const key of expectedKeys) {
      assert.ok(key in config.defaults, `defaults should have key "${key}"`);
    }

    assert.equal(config.defaults.max_iterations, 100);
    assert.equal(config.defaults.meeseeks_model, 'sonnet');
    assert.equal(config.defaults.cb_enabled, true);
    assert.equal(config.persona, true);
  });

  it('copies all 10 skills to skills root', () => {
    runInstall(tmpHome);
    const skillsRoot = path.join(tmpHome, '.agents', 'skills');

    for (const name of SKILL_NAMES) {
      const skillPath = path.join(skillsRoot, name, 'SKILL.md');
      assert.ok(fs.existsSync(skillPath), `${name}/SKILL.md should exist`);
    }
  });

  it('creates valid symlinks for scripts/', () => {
    runInstall(tmpHome);
    const skillsRoot = path.join(tmpHome, '.agents', 'skills');

    for (const name of SKILL_NAMES) {
      const linkPath = path.join(skillsRoot, name, 'scripts');
      assert.ok(fs.existsSync(linkPath), `${name}/scripts symlink should exist`);
      const target = fs.readlinkSync(linkPath);
      assert.ok(target.includes('scripts'), `symlink should point to scripts dir, got: ${target}`);
    }
  });

  it('creates session and activity directories', () => {
    runInstall(tmpHome);
    const root = path.join(tmpHome, '.pickle-rick-skills');

    assert.ok(fs.existsSync(path.join(root, 'sessions')), 'sessions/ should exist');
    assert.ok(fs.existsSync(path.join(root, 'activity')), 'activity/ should exist');
  });

  it('is idempotent — preserves user-modified values', () => {
    // First install
    runInstall(tmpHome);
    let config = readConfig(tmpHome);
    assert.equal(config.defaults.max_iterations, 100);

    // Modify a value
    config.defaults.max_iterations = 42;
    config.defaults.meeseeks_model = 'opus';
    const configPath = path.join(tmpHome, '.pickle-rick-skills', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Re-install
    runInstall(tmpHome);
    config = readConfig(tmpHome);

    assert.equal(config.defaults.max_iterations, 42, 'user-modified max_iterations should be preserved');
    assert.equal(config.defaults.meeseeks_model, 'opus', 'user-modified meeseeks_model should be preserved');
    // Non-modified defaults remain at defaults
    assert.equal(config.defaults.worker_timeout_seconds, 1200);
  });

  it('handles CLI detection with mock binaries', () => {
    // Create a mock CLI binary
    const mockBinDir = path.join(tmpHome, 'mock-bin');
    fs.mkdirSync(mockBinDir, { recursive: true });
    const mockClaude = path.join(mockBinDir, 'claude');
    fs.writeFileSync(mockClaude, '#!/bin/bash\necho "mock-claude 1.0.0"');
    fs.chmodSync(mockClaude, 0o755);

    const env = {
      ...process.env,
      PICKLE_RICK_SKILLS_HOME: path.join(tmpHome, '.pickle-rick-skills'),
      AGENTS_SKILLS_HOME: path.join(tmpHome, '.agents', 'skills'),
      PATH: `${mockBinDir}:${process.env.PATH}`,
    };
    const output = execSync(
      `bash "${PROJECT_ROOT}/install.sh" --skip-auth`,
      { env, cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30_000 },
    );

    assert.ok(output.includes('Found: claude'), 'should detect mock claude');
    const config = readConfig(tmpHome);
    assert.ok(config.runtimes.claude, 'claude runtime should exist');
    assert.equal(config.runtimes.claude.detected, true, 'claude should be detected');
  });

  it('warns when no CLIs found', () => {
    const env = {
      ...process.env,
      PICKLE_RICK_SKILLS_HOME: path.join(tmpHome, '.pickle-rick-skills'),
      AGENTS_SKILLS_HOME: path.join(tmpHome, '.agents', 'skills'),
      PATH: `${NODE_DIR}:/usr/bin:/bin`,  // node + minimal — no agent CLIs
    };
    const output = execSync(
      `bash "${PROJECT_ROOT}/install.sh" --skip-auth`,
      { env, cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30_000 },
    );

    assert.ok(output.includes('WARN'), 'should warn about no CLIs');
    // Should still exit 0 and write config
    const config = readConfig(tmpHome);
    assert.ok(config.defaults, 'config should still be written');
  });

  it('warns when tmux is missing', () => {
    const env = {
      ...process.env,
      PICKLE_RICK_SKILLS_HOME: path.join(tmpHome, '.pickle-rick-skills'),
      AGENTS_SKILLS_HOME: path.join(tmpHome, '.agents', 'skills'),
      PATH: `${NODE_DIR}:/usr/bin:/bin`,  // node + minimal — no tmux
    };
    const output = execSync(
      `bash "${PROJECT_ROOT}/install.sh" --skip-auth`,
      { env, cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30_000 },
    );

    assert.ok(output.includes('tmux'), 'should mention tmux');
  });
});

describe('uninstall.sh', () => {
  let tmpHome;

  beforeEach(() => {
    tmpHome = makeTmpHome();
    runInstall(tmpHome);
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('removes all artifacts with --force', () => {
    runUninstall(tmpHome);

    const installRoot = path.join(tmpHome, '.pickle-rick-skills');
    const skillsRoot = path.join(tmpHome, '.agents', 'skills');

    assert.ok(!fs.existsSync(installRoot), 'install root should be removed');
    for (const name of SKILL_NAMES) {
      assert.ok(!fs.existsSync(path.join(skillsRoot, name)), `${name}/ should be removed`);
    }
  });

  it('preserves activity logs with --keep-logs', () => {
    // Write a fake activity log
    const activityDir = path.join(tmpHome, '.pickle-rick-skills', 'activity');
    fs.writeFileSync(path.join(activityDir, 'test.ndjson'), '{"event":"test"}\n');

    runUninstall(tmpHome, '--keep-logs');

    const installRoot = path.join(tmpHome, '.pickle-rick-skills');
    assert.ok(fs.existsSync(path.join(installRoot, 'activity', 'test.ndjson')),
      'activity log should be preserved');
    assert.ok(!fs.existsSync(path.join(installRoot, 'config.json')),
      'config.json should be removed');
  });
});
