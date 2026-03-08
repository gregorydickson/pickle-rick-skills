import * as fs from 'fs';
import * as path from 'path';
import type { State, Step } from './types/index.js';
import { VALID_STEPS } from './types/index.js';

// ---------------------------------------------------------------------------
// Key Access Control
// ---------------------------------------------------------------------------

export const PROTECTED_KEYS: string[] = ['active', 'completion_promise', 'history'];

export const WRITABLE_KEYS: Record<string, 'numeric' | 'boolean' | 'step' | 'string'> = {
  // numeric
  iteration: 'numeric',
  max_iterations: 'numeric',
  max_time_minutes: 'numeric',
  worker_timeout_seconds: 'numeric',
  start_time_epoch: 'numeric',
  min_iterations: 'numeric',
  // boolean
  tmux_mode: 'boolean',
  chain_meeseeks: 'boolean',
  // step
  step: 'step',
  // string
  working_dir: 'string',
  original_prompt: 'string',
  current_ticket: 'string',
  started_at: 'string',
  session_dir: 'string',
  command_template: 'string',
  runtime: 'string',
};

// ---------------------------------------------------------------------------
// State I/O
// ---------------------------------------------------------------------------

export function readStateFile(sessionDir: string): State {
  const statePath = path.join(sessionDir, 'state.json');
  return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as State;
}

export function writeStateFile(sessionDir: string, state: State): void {
  const statePath = path.join(sessionDir, 'state.json');
  const tmp = `${statePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, statePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore cleanup failure */ }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// State Update with Validation
// ---------------------------------------------------------------------------

export function updateState(key: string, value: string, sessionDir: string): void {
  if (PROTECTED_KEYS.includes(key)) {
    throw new Error(`Key "${key}" is protected. Only mux-runner and cancel.js may modify it.`);
  }

  const category = WRITABLE_KEYS[key];
  if (!category) {
    throw new Error(`Unknown key "${key}". Allowed keys: ${Object.keys(WRITABLE_KEYS).join(', ')}`);
  }

  if (category === 'step' && !(VALID_STEPS as readonly string[]).includes(value)) {
    throw new Error(`Invalid step "${value}". Must be one of: ${VALID_STEPS.join(', ')}`);
  }

  const state: Record<string, unknown> = { ...readStateFile(sessionDir) };

  if (category === 'numeric') {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Key "${key}" requires a finite number, got "${value}"`);
    }
    state[key] = num;
  } else if (category === 'boolean') {
    if (value !== 'true' && value !== 'false') {
      throw new Error(`Key "${key}" requires "true" or "false", got "${value}"`);
    }
    state[key] = value === 'true';
  } else {
    state[key] = value;
  }

  writeStateFile(sessionDir, state as unknown as State);
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

if (process.argv[1] && path.basename(process.argv[1]) === 'update-state.js') {
  const [key, value, sessionDir] = process.argv.slice(2);

  if (!key || !value || !sessionDir || sessionDir.startsWith('--')) {
    console.error('Usage: node update-state.js <key> <value> <session_dir>');
    process.exit(1);
  }

  try {
    updateState(key, value, sessionDir);
    console.log(`Updated ${key} = ${value}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }
}
