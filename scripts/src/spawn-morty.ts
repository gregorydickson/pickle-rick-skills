import * as fs from 'fs';
import * as path from 'path';
import type {
  State,
  Step,
  TicketStatus,
  WorkerResult,
  WorkerContext,
  PickleRickSkillsConfig,
} from './types/index.js';
import { hasToken, PromiseTokens } from './types/index.js';
import { spawnWorker as spawnWorkerProcess } from './spawn-worker.js';
import { loadConfig, getExtensionRoot } from './services/config.js';

// ---------------------------------------------------------------------------
// Phase Instructions
// ---------------------------------------------------------------------------

const PHASE_INSTRUCTIONS: Record<Step, string> = {
  prd: 'Create the PRD. Write to `prd.md` in the session directory.',
  breakdown: 'Break down the PRD into tickets. Create `linear_ticket_<id>.md` files.',
  research: 'Research the problem space. Write findings to `research_<id>.md`.',
  plan: 'Create implementation plan. Write to `plan_<id>.md`.',
  implement: 'Implement the solution. Commit changes. Emit `<promise>I AM DONE</promise>`.',
  refactor: 'Refactor for quality. Commit changes. Emit `<promise>I AM DONE</promise>`.',
  review: 'Review implementation. Write `code_review_<id>.md`. Update ticket status to Done.',
};

// ---------------------------------------------------------------------------
// findTicketFile
// ---------------------------------------------------------------------------

export function findTicketFile(sessionDir: string, ticketId: string): string | null {
  const ticketDir = path.join(sessionDir, ticketId);
  try {
    const entries = fs.readdirSync(ticketDir);
    for (const entry of entries) {
      if (entry.startsWith('linear_ticket_') && entry.endsWith('.md')) {
        return path.join(ticketDir, entry);
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return null;
}

// ---------------------------------------------------------------------------
// buildWorkerPrompt
// ---------------------------------------------------------------------------

export function buildWorkerPrompt(
  template: string,
  ticket: string,
  step: Step,
  context: WorkerContext,
): string {
  const phaseInstructions = PHASE_INSTRUCTIONS[step] || '';

  const contextBlock = [
    `- SESSION_ROOT: ${context.sessionDir}`,
    `- TICKET_ID: ${context.ticketId}`,
    `- TICKET_DIR: ${path.join(context.sessionDir, context.ticketId)}/`,
    `- STEP: ${step}`,
    `- WORKING_DIR: ${context.workingDir}`,
  ].join('\n');

  return [
    template,
    '',
    '# TARGET TICKET CONTENT',
    ticket,
    '',
    '# EXECUTION CONTEXT',
    contextBlock,
    '',
    '# PHASE INSTRUCTIONS',
    phaseInstructions,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// updateTicketStatus
// ---------------------------------------------------------------------------

export function updateTicketStatus(ticketPath: string, newStatus: TicketStatus): void {
  const content = fs.readFileSync(ticketPath, 'utf-8');

  // Replace status line in YAML frontmatter
  const updated = content.replace(
    /^(status:\s*).*$/m,
    `$1${newStatus}`,
  );

  if (updated === content) return; // No change needed

  // Atomic write: temp + rename
  const tmp = `${ticketPath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmp, updated);
    fs.renameSync(tmp, ticketPath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* cleanup */ }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// spawnWorker (high-level)
// ---------------------------------------------------------------------------

export async function spawnWorker(
  state: State,
  ticketId: string,
  config: PickleRickSkillsConfig,
): Promise<WorkerResult> {
  const sessionDir = state.session_dir;
  const ticketDir = path.join(sessionDir, ticketId);

  // Find ticket file
  const ticketFile = findTicketFile(sessionDir, ticketId);
  if (!ticketFile) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  // Read ticket content
  const ticketContent = fs.readFileSync(ticketFile, 'utf-8');

  // Read send-to-morty template
  const extRoot = getExtensionRoot();
  const templatePath = path.join(extRoot, 'commands', 'send-to-morty.md');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Send-to-morty template not found: ${templatePath}`);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Build prompt
  const context: WorkerContext = {
    step: state.step,
    sessionDir,
    workingDir: state.working_dir,
    ticketId,
  };
  const prompt = buildWorkerPrompt(template, ticketContent, state.step, context);

  // Determine log file path
  const workerPid = Date.now(); // Use timestamp as unique suffix
  const logFile = path.join(ticketDir, `worker_session_${workerPid}.log`);

  // Ensure ticket dir exists
  fs.mkdirSync(ticketDir, { recursive: true });

  const startTime = Date.now();

  // Spawn the worker subprocess
  const result = await spawnWorkerProcess({
    prompt,
    runtime: state.runtime || config.primary_cli,
    cwd: state.working_dir,
    logFile,
    timeout: state.worker_timeout_seconds || config.defaults.worker_timeout_seconds,
    ticketPath: ticketDir,
    extensionRoot: extRoot,
  });

  const duration_ms = Date.now() - startTime;

  // Scan for WORKER_DONE token
  const done = hasToken(result.stdout, PromiseTokens.WORKER_DONE);

  return {
    exitCode: result.exitCode,
    output: result.stdout,
    pid: workerPid,
    duration_ms,
    done,
  };
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [sessionDir, ticketId] = process.argv.slice(2);

  if (!sessionDir || !ticketId) {
    console.error('Usage: node spawn-morty.js <session-dir> <ticket-id>');
    process.exit(1);
  }

  const statePath = path.join(sessionDir, 'state.json');
  if (!fs.existsSync(statePath)) {
    console.error(`state.json not found in ${sessionDir}`);
    process.exit(1);
  }

  const state: State = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  const config = loadConfig();

  const result = await spawnWorker(state, ticketId, config);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.basename(process.argv[1]) === 'spawn-morty.js') {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  });
}
