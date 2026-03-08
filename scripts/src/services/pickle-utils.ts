import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { State, TicketFrontmatter } from '../types/index.js';

// Re-export state I/O from update-state
export { readStateFile, writeStateFile } from '../update-state.js';

// ---------------------------------------------------------------------------
// Extension Root
// ---------------------------------------------------------------------------

export function getExtensionRoot(): string {
  return process.env.EXTENSION_DIR || path.join(os.homedir(), '.pickle-rick-skills');
}

// ---------------------------------------------------------------------------
// YAML Frontmatter Extraction (no regex backtracking — O(n) via indexOf)
// ---------------------------------------------------------------------------

export function extractFrontmatter(content: string): { body: string; start: number; end: number } | null {
  const openLen = content.startsWith('---\r\n') ? 5 : content.startsWith('---\n') ? 4 : 0;
  if (openLen === 0) return null;
  const closeIdx = content.indexOf('\n---', openLen);
  if (closeIdx === -1) return null;
  const rawEnd = closeIdx + 4;
  const end = content[rawEnd] === '\n' ? rawEnd + 1
    : content[rawEnd] === '\r' && content[rawEnd + 1] === '\n' ? rawEnd + 2
    : rawEnd;
  return { body: content.slice(openLen, closeIdx), start: 0, end };
}

// ---------------------------------------------------------------------------
// Ticket Frontmatter Parsing
// ---------------------------------------------------------------------------

function getField(body: string, field: string): string | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = body.match(new RegExp(`^${escaped}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

export function parseTicketFrontmatter(filePath: string): TicketFrontmatter | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fm = extractFrontmatter(content);
    if (!fm) return null;
    const id = getField(fm.body, 'id');
    const title = getField(fm.body, 'title');
    if (!id || !title) return null;
    return {
      id,
      title,
      status: (getField(fm.body, 'status') as TicketFrontmatter['status']) || 'Todo',
      priority: (getField(fm.body, 'priority') as TicketFrontmatter['priority']) || 'Medium',
      order: parseInt(getField(fm.body, 'order') || '0', 10) || 0,
      created: getField(fm.body, 'created') || '',
      updated: getField(fm.body, 'updated') || '',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ticket Collection & Marking
// ---------------------------------------------------------------------------

export function collectTickets(sessionDir: string): TicketFrontmatter[] {
  try {
    const entries = fs.readdirSync(sessionDir, { withFileTypes: true });
    const tickets: TicketFrontmatter[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = path.join(sessionDir, entry.name);
      try {
        const files = fs.readdirSync(subDir);
        for (const file of files) {
          if (!file.startsWith('linear_ticket_') || !file.endsWith('.md')) continue;
          const parsed = parseTicketFrontmatter(path.join(subDir, file));
          if (parsed) tickets.push(parsed);
        }
      } catch { /* skip unreadable dirs */ }
    }
    return tickets.sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export function markTicketDone(ticketPath: string): void {
  const content = fs.readFileSync(ticketPath, 'utf-8');
  const updated = content.replace(/^(status:\s*).*$/m, '$1"Done"');
  if (updated !== content) {
    fs.writeFileSync(ticketPath, updated);
  }
}

// ---------------------------------------------------------------------------
// Handoff Summary
// ---------------------------------------------------------------------------

function statusSymbol(status: string | null): string {
  const s = (status || '').toLowerCase().replace(/^["']|["']$/g, '');
  if (s === 'done') return '[x]';
  if (s === 'in progress') return '[~]';
  return '[ ]';
}

export function buildHandoffSummary(state: Partial<State>, sessionDir: string): string {
  const task = state.original_prompt || '';
  const truncatedTask = task.length > 300 ? task.slice(0, 300) + '...' : task;
  const prdPath = path.join(sessionDir, 'prd.md');
  const prdExists = fs.existsSync(prdPath);
  const tickets = collectTickets(sessionDir);

  const iter = Number(state.iteration) || 0;
  const maxIter = Number(state.max_iterations) || 0;
  const iterLine = maxIter > 0 ? `${iter} [of ${maxIter}]` : `${iter}`;

  const lines = [
    '=== PICKLE RICK LOOP CONTEXT ===',
    `Phase: ${state.step || 'unknown'}`,
    `Iteration: ${iterLine}`,
    `Session: ${sessionDir}`,
    `Ticket: ${state.current_ticket || 'none'}`,
    `Task: ${truncatedTask}`,
    `PRD: ${prdExists ? 'exists' : 'not yet created'}`,
  ];

  const rawMinIter = Number(state.min_iterations);
  const minIter = Number.isFinite(rawMinIter) ? rawMinIter : 0;
  if (minIter > 0) {
    lines.push(`Min Passes: ${minIter}`);
  }

  if (state.command_template) {
    lines.push(`Template: ${state.command_template}`);
  }

  if (tickets.length > 0) {
    lines.push('Tickets:');
    for (const t of tickets) {
      const sym = statusSymbol(t.status || '');
      const title = t.title.length > 60 ? t.title.slice(0, 60) + '...' : t.title;
      lines.push(`  ${sym} ${t.id}: ${title}`);
    }
  }

  const isFirstIteration = (state.history || []).length === 0;
  if (isFirstIteration) {
    lines.push(
      '',
      'THIS IS A NEW SESSION. Begin the lifecycle from the current phase.',
      'Read state.json for full context, then start working on the task.',
    );
  } else {
    lines.push(
      '',
      'NEXT ACTION: Resume from current phase. Read state.json for context.',
      'Do NOT restart from scratch. Continue where you left off.',
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handoff Consumption
// ---------------------------------------------------------------------------

export function consumeHandoff(sessionDir: string): string | null {
  const handoffPath = path.join(sessionDir, 'handoff.txt');
  try {
    const contents = fs.readFileSync(handoffPath, 'utf-8');
    fs.unlinkSync(handoffPath);
    return contents;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session Map Locking
// ---------------------------------------------------------------------------

function sleepAsync(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withSessionMapLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const lockPath = path.join(getExtensionRoot(), 'current_sessions.json.lock');
  const MAX_WAIT_MS = 3000;
  const RETRY_MS = 50;
  const STALE_MS = 5000;
  const deadline = Date.now() + MAX_WAIT_MS;
  let acquired = false;

  // Ensure parent directory exists
  const lockDir = path.dirname(lockPath);
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  while (!acquired) {
    // Check for stale lock
    let stale = false;
    try {
      const stats = fs.statSync(lockPath);
      stale = Date.now() - stats.mtimeMs > STALE_MS;
    } catch { /* lock doesn't exist — expected */ }

    if (stale) {
      try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
    }

    // Atomic exclusive create
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.closeSync(fd);
      acquired = true;
    } catch (e) {
      const code = e instanceof Error ? (e as NodeJS.ErrnoException).code : undefined;
      if (code !== 'EEXIST') throw e;
      if (Date.now() >= deadline) {
        throw new Error('session map locked');
      }
      await sleepAsync(Math.min(RETRY_MS, deadline - Date.now()));
    }
  }

  try {
    return await fn();
  } finally {
    try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Session Map Operations
// ---------------------------------------------------------------------------

function getSessionMapPath(): string {
  return path.join(getExtensionRoot(), 'current_sessions.json');
}

function readSessionMap(): Record<string, string> {
  const mapPath = getSessionMapPath();
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSessionMap(map: Record<string, string>): void {
  const mapPath = getSessionMapPath();
  const dir = path.dirname(mapPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
}

export async function updateSessionMap(cwd: string, sessionPath: string): Promise<void> {
  await withSessionMapLock(() => {
    const map = readSessionMap();
    map[cwd] = sessionPath;
    writeSessionMap(map);
  });
}

export async function removeFromSessionMap(cwd: string): Promise<void> {
  await withSessionMapLock(() => {
    const map = readSessionMap();
    delete map[cwd];
    writeSessionMap(map);
  });
}

// ---------------------------------------------------------------------------
// Session Pruning
// ---------------------------------------------------------------------------

export function pruneOldSessions(sessionsDir: string, maxAgeDays = 7): void {
  if (!fs.existsSync(sessionsDir)) return;
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  for (const entry of fs.readdirSync(sessionsDir)) {
    const sessionDir = path.join(sessionsDir, entry);
    const statePath = path.join(sessionDir, 'state.json');
    if (!fs.existsSync(statePath)) continue;

    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      if (state.active === true) continue;

      const rawMs = state.started_at
        ? new Date(state.started_at).getTime()
        : NaN;
      const startedMs = Number.isFinite(rawMs)
        ? rawMs
        : fs.statSync(sessionDir).mtimeMs;

      if (startedMs < cutoffMs) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch { /* skip unreadable sessions */ }
  }
}
