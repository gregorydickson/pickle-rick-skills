import * as path from 'path';
import { spawnSync } from 'child_process';
import { readActivityLogs } from './services/activity-logger.js';
import type { ActivityEvent } from './types/index.js';

// ---------------------------------------------------------------------------
// Arg Parsing
// ---------------------------------------------------------------------------

interface DateRange {
  since: Date;
  until: Date;
}

interface ParsedArgs {
  range: DateRange;
  json: boolean;
}

function consumeArg(argv: string[], i: number, flagName: string, hint: string): string {
  const val = argv[i + 1];
  if (val === undefined || val.startsWith('--')) {
    console.error(`Error: ${flagName} requires ${hint}.`);
    process.exit(1);
  }
  return val;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let days: number | null = null;
  let sinceStr: string | null = null;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--days') {
      const val = consumeArg(argv, i++, '--days', 'a numeric value');
      days = Number(val);
      if (!Number.isFinite(days) || days < 0 || Math.floor(days) !== days) {
        console.error(`Error: --days must be a non-negative integer, got "${val}".`);
        process.exit(1);
      }
    } else if (arg === '--since') {
      sinceStr = consumeArg(argv, i++, '--since', 'a YYYY-MM-DD value');
    } else if (arg === '--json') {
      json = true;
    } else {
      console.error(`Error: unknown flag "${arg}".`);
      process.exit(1);
    }
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (sinceStr !== null) {
    const parsed = new Date(sinceStr + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      console.error(`Error: invalid date "${sinceStr}". Use YYYY-MM-DD format.`);
      process.exit(1);
    }
    const tomorrowMidnight = new Date(todayMidnight);
    tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
    if (parsed >= tomorrowMidnight) {
      console.error(`Error: --since date "${sinceStr}" is in the future.`);
      process.exit(1);
    }
    return { range: { since: parsed, until: tomorrowMidnight }, json };
  }

  const effectiveDays = days ?? 1;
  const until = new Date(todayMidnight);
  until.setDate(until.getDate() + 1);
  const since = new Date(todayMidnight);
  since.setDate(since.getDate() - effectiveDays);

  return { range: { since, until }, json };
}

// ---------------------------------------------------------------------------
// Git Commits
// ---------------------------------------------------------------------------

export function getGitCommits(since: Date): Map<string, string> {
  const commits = new Map<string, string>();
  try {
    const result = spawnSync('git', ['log', `--after=${since.toISOString()}`, '--oneline'], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.status !== 0) return commits;
    const output = result.stdout as string;
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) {
        commits.set(trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1));
      }
    }
  } catch {
    // Not in a git repo or git not available
  }
  return commits;
}

// ---------------------------------------------------------------------------
// Commit Deduplication
// ---------------------------------------------------------------------------

interface DeduplicatedCommits {
  hookCommits: ActivityEvent[];
  gitOnlyCommits: Array<[string, string]>;
}

export function deduplicateCommits(
  events: ActivityEvent[],
  gitCommits: Map<string, string>,
): DeduplicatedCommits {
  const hookCommits = events.filter((e) => e.event === 'commit' && e.commit_hash);
  const seenHashes = hookCommits.map((e) => e.commit_hash!);
  const seenSet = new Set(seenHashes);

  const gitOnlyCommits: Array<[string, string]> = [];
  for (const [hash, msg] of gitCommits) {
    if (seenSet.has(hash) || seenHashes.some((h) => h.startsWith(hash) || hash.startsWith(h))) continue;
    gitOnlyCommits.push([hash, msg]);
  }

  return { hookCommits, gitOnlyCommits };
}

// ---------------------------------------------------------------------------
// Format Output
// ---------------------------------------------------------------------------

function dateToFilename(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatOutput(
  events: ActivityEvent[],
  hookCommits: ActivityEvent[],
  gitOnlyCommits: Array<[string, string]>,
  since: Date,
  until: Date,
): string {
  const sinceStr = dateToFilename(since);
  const untilStr = dateToFilename(until);
  const nonCommitEvents = events.filter((e) => e.event !== 'commit');
  const hasContent = nonCommitEvents.length > 0 || hookCommits.length > 0 || gitOnlyCommits.length > 0;

  if (!hasContent) {
    return `No activity found for ${sinceStr} to ${untilStr}.`;
  }

  const sessionEvents = new Map<string, ActivityEvent[]>();
  const adhocEvents: ActivityEvent[] = [];

  for (const e of nonCommitEvents) {
    if (e.session) {
      const list = sessionEvents.get(e.session) || [];
      list.push(e);
      sessionEvents.set(e.session, list);
    } else {
      adhocEvents.push(e);
    }
  }

  const sessionCommits = new Map<string, ActivityEvent[]>();
  const adhocHookCommits: ActivityEvent[] = [];

  for (const c of hookCommits) {
    if (c.session) {
      if (!sessionEvents.has(c.session)) sessionEvents.set(c.session, []);
      const list = sessionCommits.get(c.session) || [];
      list.push(c);
      sessionCommits.set(c.session, list);
    } else {
      let attributed = false;
      for (const [sid, sevts] of sessionEvents) {
        if (sevts.length === 0) continue;
        const firstTs = sevts[0].ts;
        const lastTs = sevts[sevts.length - 1].ts;
        if (c.ts >= firstTs && c.ts <= lastTs) {
          const list = sessionCommits.get(sid) || [];
          list.push(c);
          sessionCommits.set(sid, list);
          attributed = true;
          break;
        }
      }
      if (!attributed) adhocHookCommits.push(c);
    }
  }

  const LIFECYCLE_ONLY = new Set(['session_start', 'session_end']);
  const sessionEntries = [...sessionEvents.entries()]
    .filter(([sid, sevts]) => {
      const commits = sessionCommits.get(sid) || [];
      const hasMeaningfulEvents = sevts.some((e) => !LIFECYCLE_ONLY.has(e.event));
      return commits.length > 0 || hasMeaningfulEvents;
    })
    .map(([sid, sevts]) => {
      const startEvent = sevts.find((e) => e.event === 'session_start');
      const prompt = startEvent?.original_prompt;
      const taskName = prompt ? (prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt) : sid;

      const allTs = sevts.map((e) => e.ts);
      const commits = sessionCommits.get(sid) || [];
      for (const c of commits) allTs.push(c.ts);
      allTs.sort();

      const firstTs = allTs[0] || '';
      const lastTs = allTs[allTs.length - 1] || firstTs;

      const durationMs = new Date(lastTs).getTime() - new Date(firstTs).getTime();
      const durationMin = Math.floor(durationMs / 60000);
      const hours = Math.floor(durationMin / 60);
      const mins = durationMin % 60;
      const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      const iterationStarts = sevts.filter((e) => e.event === 'iteration_start');
      const iterationCount = iterationStarts.length;
      const iterationStr = iterationCount > 0 ? `${iterationCount} iteration${iterationCount === 1 ? '' : 's'}` : '? iterations';

      const mode = startEvent?.mode || (iterationCount > 0 ? 'tmux' : 'inline');

      return { sid, taskName, durationStr, iterationStr, mode, commits, firstTs };
    });

  sessionEntries.sort((a, b) => (a.firstTs > b.firstTs ? -1 : a.firstTs < b.firstTs ? 1 : 0));

  const lines: string[] = [];
  lines.push(`# Standup - ${sinceStr} to ${untilStr}`);
  lines.push('');

  for (const s of sessionEntries) {
    lines.push(`## ${s.taskName} (${s.sid})`);
    lines.push(`- **Duration**: ${s.durationStr} (${s.iterationStr})`);
    lines.push(`- **Mode**: ${s.mode}`);
    if (s.commits.length > 0) {
      lines.push('- **Commits**:');
      for (const c of s.commits) {
        const msg = c.commit_message || '(no message)';
        lines.push(`  - \`${c.commit_hash?.slice(0, 7)}\` ${msg}`);
      }
    }
    lines.push('');
  }

  const hasAdhocCommits = adhocHookCommits.length > 0 || gitOnlyCommits.length > 0;
  if (hasAdhocCommits) {
    lines.push('## Ad-hoc Commits');
    for (const c of adhocHookCommits) {
      const msg = c.commit_message || '(no message)';
      lines.push(`- \`${c.commit_hash?.slice(0, 7)}\` ${msg}`);
    }
    for (const [hash, msg] of gitOnlyCommits) {
      lines.push(`- \`${hash.slice(0, 7)}\` ${msg}`);
    }
    lines.push('');
  }

  if (adhocEvents.length > 0) {
    lines.push('## Ad-hoc Activity');
    for (const e of adhocEvents) {
      const time = e.ts.slice(11, 16);
      const detail = e.title || e.ticket || e.step || '';
      lines.push(`- \`${time}\` **${e.event}**${detail ? ` - ${detail}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { range, json } = parseArgs(process.argv.slice(2));
  const events = readActivityLogs(range.since, range.until);
  const gitCommits = getGitCommits(range.since);
  const { hookCommits, gitOnlyCommits } = deduplicateCommits(events, gitCommits);

  if (json) {
    console.log(JSON.stringify({
      since: dateToFilename(range.since),
      until: dateToFilename(range.until),
      events,
      hookCommits,
      gitOnlyCommits,
    }, null, 2));
    return;
  }

  const output = formatOutput(events, hookCommits, gitOnlyCommits, range.since, range.until);
  console.log(output);
}

if (process.argv[1] && path.basename(process.argv[1]) === 'standup.js') {
  main();
}
