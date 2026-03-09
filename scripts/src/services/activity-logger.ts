import * as fs from 'fs';
import * as path from 'path';
import type { ActivityEvent, ActivityEventType, PickleRickSkillsConfig } from '../types/index.js';
import { getExtensionRoot } from './config.js';

export function getActivityDir(): string {
  return path.join(getExtensionRoot(), 'activity');
}

export function logActivity(
  event: Partial<ActivityEvent> & { event: ActivityEventType; source: ActivityEvent['source'] },
  config?: Pick<PickleRickSkillsConfig, 'defaults'>,
): void {
  if (config && config.defaults.activity_logging === false) return;

  try {
    const activityDir = getActivityDir();
    fs.mkdirSync(activityDir, { recursive: true, mode: 0o700 });
    const date = new Date().toLocaleDateString('en-CA');
    const filepath = path.join(activityDir, `activity-${date}.ndjson`);
    const fullEvent: ActivityEvent = { ts: new Date().toISOString(), ...event };
    const line = JSON.stringify(fullEvent) + '\n';
    fs.appendFileSync(filepath, line, { mode: 0o600 });
  } catch {
    // Silent failure — activity logging must never break the caller
  }
}

const DATE_NDJSON_RE = /^activity-\d{4}-\d{2}-\d{2}\.ndjson$/;

/**
 * Deletes NDJSON activity files older than maxAgeDays by filename date.
 * Handles ENOENT race (concurrent sessions may delete the same file).
 */
export function pruneActivity(maxAgeDays = 365): number {
  const activityDir = getActivityDir();
  if (!fs.existsSync(activityDir)) return 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoffMs = now.getTime() - maxAgeDays * 86_400_000;

  let deleted = 0;
  for (const entry of fs.readdirSync(activityDir)) {
    if (!DATE_NDJSON_RE.test(entry)) continue;
    const dateStr = entry.replace(/^activity-/, '').replace(/\.ndjson$/, '');
    const fileMs = new Date(dateStr + 'T00:00:00').getTime();
    if (!Number.isFinite(fileMs)) continue;
    if (fileMs >= cutoffMs) continue;
    try {
      fs.unlinkSync(path.join(activityDir, entry));
      deleted++;
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  return deleted;
}

/**
 * Reads and parses NDJSON activity log files within a date range.
 * Skips malformed lines. Returns events sorted by timestamp.
 */
export function readActivityLogs(since: Date, until?: Date): ActivityEvent[] {
  const activityDir = getActivityDir();
  if (!fs.existsSync(activityDir)) return [];

  let files: string[];
  try {
    files = fs.readdirSync(activityDir).filter((f) => DATE_NDJSON_RE.test(f));
  } catch {
    return [];
  }

  const sinceMs = since.getTime();
  const untilMs = until ? until.getTime() : Date.now() + 86_400_000;

  const matchingFiles = files.filter((f) => {
    const dateStr = f.replace(/^activity-/, '').replace(/\.ndjson$/, '');
    const fileMs = new Date(dateStr + 'T00:00:00').getTime();
    return Number.isFinite(fileMs) && fileMs >= sinceMs && fileMs < untilMs;
  });

  const events: ActivityEvent[] = [];
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  for (const file of matchingFiles) {
    const filePath = path.join(activityDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_BYTES) continue;
    } catch { continue; }

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as ActivityEvent;
        if (typeof parsed.ts === 'string' && typeof parsed.event === 'string') {
          events.push(parsed);
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return events;
}
