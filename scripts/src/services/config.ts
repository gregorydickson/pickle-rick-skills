import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { PickleRickSkillsConfig, RuntimeConfig } from '../types/index.js';

// ---------------------------------------------------------------------------
// Extension Root
// ---------------------------------------------------------------------------

export function getExtensionRoot(): string {
  return process.env.EXTENSION_DIR || path.join(os.homedir(), '.pickle-rick-skills');
}

// ---------------------------------------------------------------------------
// Default Config Values
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG_DEFAULTS: PickleRickSkillsConfig['defaults'] = {
  max_iterations: 100,
  max_time_minutes: 720,
  worker_timeout_seconds: 1200,
  manager_max_turns: 50,
  tmux_max_turns: 200,
  meeseeks_min_passes: 10,
  meeseeks_max_passes: 50,
  meeseeks_model: 'sonnet',
  council_min_passes: 5,
  council_max_passes: 20,
  refinement_cycles: 3,
  refinement_max_turns: 100,
  circuit_breaker_enabled: true,
  cb_no_progress_threshold: 5,
  cb_same_error_threshold: 5,
  cb_half_open_after: 2,
  rate_limit_wait_minutes: 60,
  max_rate_limit_retries: 3,
  sigkill_grace_seconds: 5,
  max_retries_per_ticket: 3,
};

// ---------------------------------------------------------------------------
// Runtime Registry — 3 Tiers
// ---------------------------------------------------------------------------

export const VERIFIED_RUNTIMES: Record<string, RuntimeConfig> = {
  claude: {
    bin: 'claude',
    prompt_flag: '-p',
    extra_flags: ['--dangerously-skip-permissions', '--no-session-persistence'],
    json_output_flag: '--output-format stream-json',
    auto_approve_flag: '--dangerously-skip-permissions',
    detected: false,
    add_dir_flag: '--add-dir',
    max_turns_flag: '--max-turns',
    model_flag: '--model',
    verbose_flag: '--verbose',
    no_session_flag: '--no-session-persistence',
    env_set: { PYTHONUNBUFFERED: '1' },
    env_delete: ['CLAUDECODE'],
    tier: 'verified',
  },
};

export const PENDING_RUNTIMES: Record<string, RuntimeConfig> = {
  gemini: {
    bin: 'gemini',
    prompt_flag: '-p',
    extra_flags: [],
    json_output_flag: '--output-format json',
    auto_approve_flag: null,
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: null,
    env_set: {},
    env_delete: [],
    tier: 'pending',
  },
  codex: {
    bin: 'codex',
    prompt_flag: 'exec',
    extra_flags: ['--full-auto'],
    json_output_flag: '--json',
    auto_approve_flag: '--full-auto',
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: null,
    env_set: {},
    env_delete: [],
    tier: 'pending',
  },
};

export const COMMUNITY_RUNTIMES: Record<string, RuntimeConfig> = {
  hermes: {
    bin: 'hermes',
    prompt_flag: 'chat -q',
    extra_flags: [],
    json_output_flag: null,
    auto_approve_flag: null,
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: null,
    env_set: {},
    env_delete: [],
    tier: 'community',
  },
  goose: {
    bin: 'goose',
    prompt_flag: 'run -t',
    extra_flags: ['--no-session'],
    json_output_flag: '--output-format stream-json',
    auto_approve_flag: null,
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: '--no-session',
    env_set: {},
    env_delete: [],
    tier: 'community',
  },
  amp: {
    bin: 'amp',
    prompt_flag: '-x',
    extra_flags: ['--dangerously-allow-all'],
    json_output_flag: '--stream-json',
    auto_approve_flag: '--dangerously-allow-all',
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: null,
    env_set: {},
    env_delete: [],
    tier: 'community',
  },
  opencode: {
    bin: 'opencode',
    prompt_flag: 'run',
    extra_flags: [],
    json_output_flag: '--format json',
    auto_approve_flag: null,
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: null,
    env_set: {},
    env_delete: [],
    tier: 'community',
  },
  aider: {
    bin: 'aider',
    prompt_flag: '-m',
    extra_flags: ['--yes'],
    json_output_flag: null,
    auto_approve_flag: '--yes',
    detected: false,
    add_dir_flag: null,
    max_turns_flag: null,
    model_flag: null,
    verbose_flag: null,
    no_session_flag: null,
    env_set: {},
    env_delete: [],
    tier: 'community',
  },
};

export const ALL_DEFAULT_RUNTIMES: Record<string, RuntimeConfig> = {
  ...VERIFIED_RUNTIMES,
  ...PENDING_RUNTIMES,
  ...COMMUNITY_RUNTIMES,
};

// ---------------------------------------------------------------------------
// Config Loading
// ---------------------------------------------------------------------------

export function getDefaultConfigPath(): string {
  return path.join(getExtensionRoot(), 'config.json');
}

export function loadConfig(configPath?: string): PickleRickSkillsConfig {
  const filePath = configPath ?? getDefaultConfigPath();
  let raw: Partial<PickleRickSkillsConfig> = {};

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    raw = JSON.parse(content) as Partial<PickleRickSkillsConfig>;
  }

  const config: PickleRickSkillsConfig = {
    primary_cli: raw.primary_cli ?? 'claude',
    runtimes: { ...ALL_DEFAULT_RUNTIMES, ...raw.runtimes },
    defaults: { ...DEFAULT_CONFIG_DEFAULTS, ...raw.defaults },
    persona: raw.persona ?? true,
    activity_logging: raw.activity_logging ?? true,
  };

  validateConfig(config);
  return config;
}

// ---------------------------------------------------------------------------
// Config Validation
// ---------------------------------------------------------------------------

const VALID_PRIMARY_CLIS = ['claude', 'gemini', 'codex', 'hermes', 'goose', 'amp', 'opencode', 'aider'] as const;

export function validateConfig(config: PickleRickSkillsConfig): void {
  if (!VALID_PRIMARY_CLIS.includes(config.primary_cli)) {
    throw new Error(
      `Invalid primary_cli "${config.primary_cli}". Must be one of: ${VALID_PRIMARY_CLIS.join(', ')}`
    );
  }

  const d = config.defaults;

  if (d.cb_no_progress_threshold < 2) {
    throw new Error(
      `cb_no_progress_threshold must be >= 2, got ${d.cb_no_progress_threshold}`
    );
  }

  if (d.cb_same_error_threshold < 2) {
    throw new Error(
      `cb_same_error_threshold must be >= 2, got ${d.cb_same_error_threshold}`
    );
  }

  if (d.cb_half_open_after >= d.cb_no_progress_threshold) {
    throw new Error(
      `cb_half_open_after (${d.cb_half_open_after}) must be < cb_no_progress_threshold (${d.cb_no_progress_threshold})`
    );
  }
}
