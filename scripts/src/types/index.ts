// ---------------------------------------------------------------------------
// Lifecycle Steps
// ---------------------------------------------------------------------------

export const VALID_STEPS = ['prd', 'breakdown', 'research', 'plan', 'implement', 'refactor', 'review'] as const;
export type Step = typeof VALID_STEPS[number];

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

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
  min_iterations: number;
  command_template: string;
  chain_meeseeks: boolean;
  runtime: string;
}

// ---------------------------------------------------------------------------
// Promise Tokens
// ---------------------------------------------------------------------------

export const PromiseTokens = {
  WORKER_DONE: 'I AM DONE',
  EPIC_COMPLETED: 'EPIC_COMPLETED',
  PRD_COMPLETE: 'PRD_COMPLETE',
  TICKET_SELECTED: 'TICKET_SELECTED',
  EXISTENCE_IS_PAIN: 'EXISTENCE_IS_PAIN',
  THE_CITADEL_APPROVES: 'THE_CITADEL_APPROVES',
  TASK_COMPLETED: 'TASK_COMPLETED',
  ANALYSIS_DONE: 'ANALYSIS_DONE',
} as const;

/** Returns true if `text` contains `<promise>TOKEN</promise>`, tolerating whitespace inside tags. */
export function hasToken(text: string, token: string): boolean {
  if (!text || !token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<promise>\\s*${escaped}\\s*</promise>`).test(text);
}

/** Wraps `token` in promise XML tags. */
export function wrapToken(token: string): string {
  return `<promise>${token}</promise>`;
}

// ---------------------------------------------------------------------------
// Completion Classification
// ---------------------------------------------------------------------------

export type CompletionClassification = 'task_completed' | 'review_clean' | 'continue';

// ---------------------------------------------------------------------------
// Iteration Exit
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Session Exit
// ---------------------------------------------------------------------------

export type SessionExitReason = 'success' | 'cancelled' | 'error' | 'limit'
  | 'stall' | 'circuit_open' | 'rate_limit_exhausted';

// ---------------------------------------------------------------------------
// Ticket Frontmatter
// ---------------------------------------------------------------------------

export interface TicketFrontmatter {
  id: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done' | 'Failed';
  priority: 'High' | 'Medium' | 'Low';
  order: number;
  created: string;
  updated: string;
  depends_on?: string[];
  links?: Array<{ url: string; title: string }>;
}

// ---------------------------------------------------------------------------
// Activity Events
// ---------------------------------------------------------------------------

export const VALID_ACTIVITY_EVENTS = [
  'session_start', 'session_end',
  'iteration_start', 'iteration_end',
  'worker_spawn', 'worker_exit',
  'rate_limit_wait', 'rate_limit_resume', 'rate_limit_exhausted',
  'circuit_open', 'circuit_half_open', 'circuit_recovery', 'circuit_reset',
  'degenerate_detected',
  'ticket_started', 'ticket_completed', 'ticket_failed',
  'meeseeks_pass', 'refinement_cycle', 'cancellation',
] as const;

export type ActivityEventType = typeof VALID_ACTIVITY_EVENTS[number];

export interface ActivityEvent {
  timestamp: string;
  event: ActivityEventType;
  source: string;
  session: string;
  iteration?: number;
  step?: string;
  ticket?: string;
  exitCode?: number;
  exitReason?: SessionExitReason;
  duration_ms?: number;
  completion?: CompletionClassification;
  error?: string;
  rate_limit_type?: string;
  wait_minutes?: number;
  cb_state?: string;
  cb_consecutive_no_progress?: number;
  cb_consecutive_same_error?: number;
  worker_pid?: number;
  role?: string;
  cycle?: number;
  git_head?: string;
  model?: string;
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export interface CircuitBreakerState {
  state: CircuitState;
  consecutive_no_progress: number;
  consecutive_same_error: number;
  last_error_signature: string | null;
  last_known_head: string | null;
  last_known_step: string | null;
  last_known_ticket: string | null;
  last_known_uncommitted: boolean;
  last_known_staged: boolean;
  opened_at: string | null;
  half_open_at: string | null;
  reason: string | null;
  history: Array<{
    from: string;
    to: string;
    timestamp: string;
    reason: string;
  }>;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  noProgressThreshold: number;
  sameErrorThreshold: number;
  halfOpenAfter: number;
}

// ---------------------------------------------------------------------------
// Spawn Interfaces
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
  env: {
    set: { PICKLE_STATE_FILE: string; PYTHONUNBUFFERED: '1' };
    delete: ['CLAUDECODE', 'PICKLE_ROLE'];
  };
}

export interface SpawnWorkerArgs {
  prompt: string;
  runtime: string;
  cwd: string;
  logFile: string;
  timeout: number;
  ticketPath: string;
  extensionRoot: string;
  env: {
    set: { PICKLE_STATE_FILE: string; PICKLE_ROLE: 'worker'; PYTHONUNBUFFERED: '1' };
    delete: ['CLAUDECODE'];
  };
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
// Skills Configuration
// ---------------------------------------------------------------------------

export interface PickleRickSkillsConfig {
  primary_cli: 'claude' | 'gemini' | 'codex' | 'hermes' | 'goose' | 'amp' | 'opencode' | 'aider';
  runtimes: Record<string, RuntimeConfig>;
  defaults: {
    max_iterations: number;
    max_time_minutes: number;
    worker_timeout_seconds: number;
    manager_max_turns: number;
    tmux_max_turns: number;
    meeseeks_min_passes: number;
    meeseeks_max_passes: number;
    meeseeks_model: string;
    council_min_passes: number;
    council_max_passes: number;
    refinement_cycles: number;
    refinement_max_turns: number;
    circuit_breaker_enabled: boolean;
    cb_no_progress_threshold: number;
    cb_same_error_threshold: number;
    cb_half_open_after: number;
    rate_limit_wait_minutes: number;
    max_rate_limit_retries: number;
    sigkill_grace_seconds: number;
    max_retries_per_ticket: number;
  };
  persona: boolean;
  activity_logging: boolean;
}
