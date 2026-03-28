// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

export const VALID_STEPS = ['prd', 'breakdown', 'research', 'plan', 'implement', 'refactor', 'review'] as const;
export type Step = typeof VALID_STEPS[number];

export interface State {
  active: boolean;
  working_dir: string;
  step: Step;
  iteration: number;
  max_iterations: number;
  max_time_minutes: number;
  worker_timeout_seconds: number;
  start_time_epoch: number;
  completion_promise: string | null;
  original_prompt: string;
  current_ticket: string | null;
  history: Array<{ step: Step; ticket?: string; timestamp: string }>;
  started_at: string;
  session_dir: string;
  tmux_mode?: boolean;
  min_iterations?: number;
  command_template?: string;
  chain_meeseeks?: boolean;
  runtime?: string;
}

// ---------------------------------------------------------------------------
// Default Configuration Values
// ---------------------------------------------------------------------------

export const Defaults = {
  WORKER_TIMEOUT_SECONDS: 1200,
  MANAGER_MAX_TURNS: 50,
  RATE_LIMIT_POLL_MS: 10_000,
} as const;

// ---------------------------------------------------------------------------
// Promise Tokens
// ---------------------------------------------------------------------------

export const PromiseTokens = {
  EPIC_COMPLETED: 'EPIC_COMPLETED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  WORKER_DONE: 'I AM DONE',
  PRD_COMPLETE: 'PRD_COMPLETE',
  TICKET_SELECTED: 'TICKET_SELECTED',
  ANALYSIS_DONE: 'ANALYSIS_DONE',
  EXISTENCE_IS_PAIN: 'EXISTENCE_IS_PAIN',
  THE_CITADEL_APPROVES: 'THE_CITADEL_APPROVES',
} as const;

export function hasToken(text: string, token: string): boolean {
  if (!text || !token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<promise>\\s*${escaped}\\s*</promise>`).test(text);
}

// ---------------------------------------------------------------------------
// Classification Types
// ---------------------------------------------------------------------------

export type CompletionClassification = 'task_completed' | 'review_clean' | 'continue';

export type SessionExitReason = 'success' | 'cancelled' | 'error' | 'limit' | 'stall' | 'circuit_open' | 'rate_limit_exhausted';

export type IterationExitType = 'success' | 'error' | 'api_limit' | 'inactive';

export interface RateLimitInfo {
  limited: boolean;
  resetsAt?: number;
  rateLimitType?: string;
}

export interface IterationExitResult {
  type: IterationExitType;
  rateLimitInfo?: RateLimitInfo;
}

export interface RateLimitAction {
  action: 'wait' | 'bail';
  waitMs: number;
  waitSource: 'api' | 'config';
  resetCounter: boolean;
  hasResetsAt: boolean;
}

export interface RateLimitWaitInfo {
  waiting: boolean;
  reason: string;
  started_at: string;
  wait_until: string;
  consecutive_waits: number;
  rate_limit_type: 'five_hour' | 'seven_day' | 'unknown';
  resets_at_epoch: number;
  wait_source: 'api' | 'config';
}

// ---------------------------------------------------------------------------
// Runtime Configuration
// ---------------------------------------------------------------------------

export interface RuntimeConfig {
  bin: string;
  prompt_flag: string;
  extra_flags: string[];
  json_output_flag: string | null;
  auto_approve_flag: string | null;
  detected: boolean;
  add_dir_flag: string | null;
  max_turns_flag: string | null;
  model_flag: string | null;
  verbose_flag: string | null;
  no_session_flag: string | null;
  env_set: Record<string, string>;
  env_delete: string[];
  tier: 'verified' | 'pending' | 'community';
}

// ---------------------------------------------------------------------------
// Configuration Schema (20 defaults)
// ---------------------------------------------------------------------------

export interface PickleRickSkillsConfig {
  primary_cli: string;
  runtimes: Record<string, RuntimeConfig>;
  defaults: {
    max_iterations: number;
    max_time_minutes: number;
    worker_timeout_seconds: number;
    tmux_max_turns: number;
    manager_max_turns: number;
    refinement_cycles: number;
    refinement_max_turns: number;
    refinement_worker_timeout_seconds: number;
    meeseeks_min_passes: number;
    meeseeks_max_passes: number;
    meeseeks_model: string;
    rate_limit_wait_minutes: number;
    max_rate_limit_retries: number;
    rate_limit_poll_ms: number;
    sigkill_grace_seconds: number;
    cb_enabled: boolean;
    cb_no_progress_threshold: number;
    cb_half_open_after: number;
    cb_error_threshold: number;
    chain_meeseeks: boolean;
    activity_logging: boolean;
  };
}

// ---------------------------------------------------------------------------
// Spawn Arguments
// ---------------------------------------------------------------------------

export interface SpawnManagerArgs {
  prompt: string;
  runtime: string;
  cwd: string;
  logFile: string;
  timeout: number;
  sessionDir: string;
  extensionRoot: string;
  maxTurns: number;
  model?: string;
  env?: Record<string, string>;
  onPid?: (pid: number) => void;
}

export interface SpawnWorkerArgs {
  prompt: string;
  runtime: string;
  cwd: string;
  logFile: string;
  timeout: number;
  ticketPath: string;
  extensionRoot: string;
  env?: Record<string, string>;
}

export interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

// ---------------------------------------------------------------------------
// Worker Result (high-level, returned by spawn-morty)
// ---------------------------------------------------------------------------

export type TicketStatus = 'Todo' | 'In Progress' | 'Done' | 'Blocked';

export interface WorkerResult {
  exitCode: number | null;
  output: string;
  pid: number;
  duration_ms: number;
  done: boolean;
}

export interface WorkerContext {
  step: Step;
  sessionDir: string;
  workingDir: string;
  ticketId: string;
}

// ---------------------------------------------------------------------------
// Activity Events
// ---------------------------------------------------------------------------

export const VALID_ACTIVITY_EVENTS = [
  'session_start', 'session_end', 'ticket_completed', 'epic_completed',
  'meeseeks_pass', 'commit', 'research', 'bug_fix', 'feature',
  'refactor', 'review', 'jar_start', 'jar_end',
  'circuit_open', 'circuit_recovery',
  'iteration_start', 'iteration_end',
  'rate_limit_wait', 'rate_limit_resume', 'rate_limit_exhausted',
] as const;

export type ActivityEventType = typeof VALID_ACTIVITY_EVENTS[number];

export interface ActivityEvent {
  ts: string;
  event: ActivityEventType;
  source: 'pickle' | 'hook' | 'persona';
  session?: string;
  epic?: string;
  ticket?: string;
  title?: string;
  step?: string;
  mode?: string;
  pass?: number;
  commit_hash?: string;
  commit_message?: string;
  duration_min?: number;
  error?: string;
  iteration?: number;
  exit_type?: IterationExitType;
  original_prompt?: string;
}

// ---------------------------------------------------------------------------
// Microverse Types
// ---------------------------------------------------------------------------

export interface MicroverseMetric {
  description: string;
  validation: string;
  type: 'command' | 'llm';
  timeout_seconds: number;
  tolerance: number;
  direction?: 'higher' | 'lower';
  judge_model?: string;
}

export interface MicroverseHistoryEntry {
  iteration: number;
  metric_value: string;
  score: number;
  action: 'accept' | 'revert';
  description: string;
  pre_iteration_sha: string;
  timestamp: string;
}

export interface MicroverseSessionState {
  status: 'gap_analysis' | 'iterating' | 'converged' | 'stopped';
  prd_path: string;
  key_metric: MicroverseMetric;
  convergence: {
    stall_limit: number;
    stall_counter: number;
    history: MicroverseHistoryEntry[];
  };
  gap_analysis_path: string;
  failed_approaches: string[];
  baseline_score: number;
  exit_reason?: string;
  stash_ref?: string;
}
