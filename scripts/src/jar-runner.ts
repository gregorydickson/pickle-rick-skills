import * as fs from 'fs';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import type { State } from './types/index.js';
import { loadConfig, getExtensionRoot } from './services/config.js';
import { setup } from './setup.js';
import {
  readJarQueue,
  verifyIntegrity,
  updateTaskStatus,
  type JarTask,
} from './services/jar-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeStateFile(filePath: string, state: object): void {
  const tmp = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, filePath);
}

function readStateFile(filePath: string): State {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as State;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export function buildJarNotification(succeeded: number, failed: number): { title: string; body: string } {
  const allFailed = succeeded === 0 && failed > 0;
  const title = allFailed ? 'Pickle Jar Failed' : 'Pickle Jar Complete';
  const body = failed > 0
    ? `${succeeded} succeeded, ${failed} failed`
    : `${succeeded} task${succeeded === 1 ? '' : 's'} completed`;
  return { title, body };
}

function sendJarNotification(succeeded: number, failed: number): void {
  if (process.platform !== 'darwin') return;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const { title, body } = buildJarNotification(succeeded, failed);
  spawnSync('osascript', ['-e', `display notification "${esc(body)}" with title "${esc(title)}"`]);
}

// ---------------------------------------------------------------------------
// Run Single Task
// ---------------------------------------------------------------------------

async function runTask(task: JarTask, dryRun: boolean): Promise<boolean> {
  const config = loadConfig();
  const managerMaxTurns = config.defaults.manager_max_turns;

  if (!fs.existsSync(task.prd_path)) {
    console.error(`  PRD not found: ${task.prd_path}`);
    return false;
  }

  if (!verifyIntegrity(task)) {
    console.error(`  SHA-256 integrity check failed — PRD modified since queueing`);
    updateTaskStatus(task.id, 'integrity_failed');
    return false;
  }

  if (dryRun) {
    console.log(`  [dry-run] Would execute: ${task.task}`);
    return true;
  }

  updateTaskStatus(task.id, 'running', { started_at: new Date().toISOString() });

  // Create session for this task via setup()
  let sessionDir: string;
  try {
    sessionDir = await setup([
      '--max-iterations', String(managerMaxTurns),
      task.task,
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Setup failed: ${msg}`);
    return false;
  }

  // Modify state for jar-specific settings
  const statePath = path.join(sessionDir, 'state.json');
  try {
    const state = readStateFile(statePath);
    state.completion_promise = 'JARRED';
    writeStateFile(statePath, state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Failed to update state: ${msg}`);
    return false;
  }

  updateTaskStatus(task.id, 'running', { session_dir: sessionDir });

  // Spawn mux-runner.js per task — NEVER direct CLI
  const muxRunnerPath = path.join(__dirname, 'mux-runner.js');

  return new Promise((resolve) => {
    const proc = spawn('node', [muxRunnerPath, sessionDir], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', (err) => {
      console.error(`  Spawn error: ${err instanceof Error ? err.message : String(err)}`);
      resolve(false);
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const queue = readJarQueue();
  const pending = queue.tasks.filter(t => t.status === 'queued');

  if (pending.length === 0) {
    console.log('No tasks queued.');
    return;
  }

  console.log(`\nPickle Jar — ${pending.length} task(s) queued\n`);

  let succeeded = 0;
  let failed = 0;

  // Sequential execution — one task at a time
  for (const task of pending) {
    console.log(`Task ${task.id}: ${task.task}`);

    const ok = await runTask(task, dryRun);

    if (ok) {
      succeeded++;
      updateTaskStatus(task.id, 'completed', { completed_at: new Date().toISOString() });
      console.log(`  ✓ completed\n`);
    } else {
      failed++;
      // Re-read from disk — runTask may have already set integrity_failed
      const currentQueue = readJarQueue();
      const diskTask = currentQueue.tasks.find(t => t.id === task.id);
      if (!diskTask || diskTask.status !== 'integrity_failed') {
        updateTaskStatus(task.id, 'failed', {
          completed_at: new Date().toISOString(),
          exit_reason: 'mux-runner exited non-zero',
        });
      }
      console.log(`  ✗ failed\n`);
    }
  }

  console.log(`Jar complete. ${succeeded} succeeded, ${failed} failed.`);
  sendJarNotification(succeeded, failed);
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

if (process.argv[1] && path.basename(process.argv[1]) === 'jar-runner.js') {
  main(process.argv.slice(2)).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  });
}
