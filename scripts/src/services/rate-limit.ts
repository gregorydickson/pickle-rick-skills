import * as fs from 'fs';
import * as path from 'path';
import type { RateLimitInfo, IterationExitResult, RateLimitWaitInfo, State } from '../types/index.js';

// ---------------------------------------------------------------------------
// Text Pattern Detection
// ---------------------------------------------------------------------------

const RATE_LIMIT_TEXT_PATTERNS = [
  /5.*hour.*limit/i,
  /limit.*reached.*try.*back/i,
  /usage.*limit.*reached/i,
  /rate limit/i,
  /out of (extra )?usage/i,
];

export function detectRateLimitText(output: string): boolean {
  return RATE_LIMIT_TEXT_PATTERNS.some(p => p.test(output));
}

// ---------------------------------------------------------------------------
// JSON Event Detection
// ---------------------------------------------------------------------------

export function detectRateLimitJSON(output: string): RateLimitInfo | null {
  const lines = output.split('\n');
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.type !== 'rate_limit_event') continue;
      const info = (parsed.rate_limit_info ?? parsed) as Record<string, unknown>;
      if (info.status === 'rejected') {
        const result: RateLimitInfo = { limited: true };
        if (typeof info.resetsAt === 'number') result.resetsAt = info.resetsAt;
        if (typeof info.rateLimitType === 'string') result.rateLimitType = info.rateLimitType;
        return result;
      }
    } catch {
      // Not JSON — skip
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Iteration Exit Classification
// ---------------------------------------------------------------------------

export function classifyIterationExit(
  exitCode: number | null,
  output: string,
  state: Partial<State>,
): IterationExitResult {
  // Inactive check
  if (state.active === false) {
    return { type: 'inactive' };
  }

  // Rate limit detection (runs BEFORE error classification)
  const rateLimitInfo = detectRateLimitJSON(output);
  if (rateLimitInfo) {
    return { type: 'api_limit', rateLimitInfo };
  }
  if (detectRateLimitText(output)) {
    return { type: 'api_limit' };
  }

  // Error exit (non-zero)
  if (exitCode !== null && exitCode !== 0) {
    return { type: 'error' };
  }

  return { type: 'success' };
}

// ---------------------------------------------------------------------------
// Wait File Management
// ---------------------------------------------------------------------------

export function writeRateLimitWaitFile(sessionDir: string, info: RateLimitWaitInfo): void {
  const filePath = path.join(sessionDir, 'rate_limit_wait.json');
  const tmp = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(info, null, 2));
  fs.renameSync(tmp, filePath);
}

export function clearRateLimitWaitFile(sessionDir: string): void {
  const filePath = path.join(sessionDir, 'rate_limit_wait.json');
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File doesn't exist — that's fine
  }
}

// ---------------------------------------------------------------------------
// Wait Time Calculation
// ---------------------------------------------------------------------------

export function calculateWaitTime(resetsAt: number | undefined, configMinutes: number): number {
  const configMs = configMinutes * 60 * 1000;
  const maxMs = (3 * configMinutes * 60 + 30) * 1000;

  if (resetsAt === undefined) return configMs;

  const nowEpoch = Math.floor(Date.now() / 1000);
  const deltaSeconds = resetsAt - nowEpoch;

  if (deltaSeconds <= 0) return configMs;

  const waitMs = (deltaSeconds + 30) * 1000; // 30s buffer
  return Math.min(waitMs, maxMs);
}

// ---------------------------------------------------------------------------
// Cancellable Wait
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 100; // Fast polling for tests; mux-runner uses its own interval

export async function cancellableWait(
  sessionDir: string,
  waitMs: number,
  stateFile: string,
): Promise<boolean> {
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    // Check if session was cancelled
    try {
      const raw = fs.readFileSync(stateFile, 'utf-8');
      const state = JSON.parse(raw) as { active?: boolean };
      if (state.active === false) {
        clearRateLimitWaitFile(sessionDir);
        return false;
      }
    } catch {
      // State file unreadable — continue waiting
    }

    const remaining = deadline - Date.now();
    const sleepTime = Math.min(POLL_INTERVAL_MS, remaining);
    if (sleepTime <= 0) break;
    await new Promise<void>((resolve) => setTimeout(resolve, sleepTime));
  }

  return true;
}
