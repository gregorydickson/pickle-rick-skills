import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getExtensionRoot } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JarStatus = 'queued' | 'running' | 'completed' | 'failed' | 'integrity_failed' | 'skipped';

export interface JarTask {
  id: string;
  prd_path: string;
  task: string;
  sha256: string;
  status: JarStatus;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  session_dir?: string;
  exit_reason?: string;
}

export interface JarQueue {
  tasks: JarTask[];
}

// ---------------------------------------------------------------------------
// Path Validation
// ---------------------------------------------------------------------------

export function validatePrdPath(prdPath: string): void {
  if (prdPath.includes('\0')) {
    throw new Error('Invalid PRD path: path traversal detected');
  }
  if (prdPath.includes('..')) {
    throw new Error('Invalid PRD path: path traversal detected');
  }
  const resolved = path.resolve(prdPath);
  const cwd = process.cwd();
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error('Invalid PRD path: path traversal detected');
  }
}

// ---------------------------------------------------------------------------
// Queue Operations
// ---------------------------------------------------------------------------

function getQueuePath(): string {
  return path.join(getExtensionRoot(), 'jar-queue.json');
}

export function readJarQueue(): JarQueue {
  const queuePath = getQueuePath();
  try {
    const raw = fs.readFileSync(queuePath, 'utf-8');
    const parsed = JSON.parse(raw) as JarQueue;
    if (!Array.isArray(parsed.tasks)) return { tasks: [] };
    return parsed;
  } catch {
    return { tasks: [] };
  }
}

export function writeJarQueue(queue: JarQueue): void {
  const queuePath = getQueuePath();
  const dir = path.dirname(queuePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${queuePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2));
  fs.renameSync(tmp, queuePath);
}

// ---------------------------------------------------------------------------
// Integrity Verification
// ---------------------------------------------------------------------------

export function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function verifyIntegrity(task: JarTask): boolean {
  try {
    const currentHash = computeSha256(task.prd_path);
    return currentHash === task.sha256;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Task Management
// ---------------------------------------------------------------------------

export function addToJar(prdPath: string, task: string): JarTask {
  validatePrdPath(prdPath);

  const resolvedPath = path.resolve(prdPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`PRD file not found: ${resolvedPath}`);
  }

  const sha256 = computeSha256(resolvedPath);
  const id = crypto.randomBytes(8).toString('hex');

  const jarTask: JarTask = {
    id,
    prd_path: resolvedPath,
    task,
    sha256,
    status: 'queued',
    queued_at: new Date().toISOString(),
  };

  const queue = readJarQueue();
  queue.tasks.push(jarTask);
  writeJarQueue(queue);

  return jarTask;
}

export function updateTaskStatus(taskId: string, status: JarStatus, updates?: Partial<JarTask>): void {
  const queue = readJarQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.status = status;
  if (updates) Object.assign(task, updates);
  writeJarQueue(queue);
}
