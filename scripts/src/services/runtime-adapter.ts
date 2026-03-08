import type { PickleRickSkillsConfig, RuntimeConfig, SpawnManagerArgs, SpawnWorkerArgs } from '../types/index.js';

// ---------------------------------------------------------------------------
// Runtime Resolution
// ---------------------------------------------------------------------------

export function resolveRuntime(runtimeName: string, config: PickleRickSkillsConfig): RuntimeConfig {
  const runtime = config.runtimes[runtimeName];
  if (!runtime) {
    const available = Object.keys(config.runtimes).join(', ');
    throw new Error(`Unknown runtime "${runtimeName}". Available: ${available}`);
  }
  return runtime;
}

// ---------------------------------------------------------------------------
// Command Building — Core
// ---------------------------------------------------------------------------

function buildCommandCore(runtime: RuntimeConfig, prompt: string): string[] {
  const cmd: string[] = [runtime.bin];
  // Split multi-word prompt_flag (e.g. 'chat -q' → ['chat', '-q'])
  cmd.push(...runtime.prompt_flag.split(/\s+/));
  cmd.push(prompt);
  cmd.push(...runtime.extra_flags);
  return cmd;
}

function appendFlag(cmd: string[], flag: string | null, value?: string): void {
  if (flag === null) return;
  cmd.push(flag);
  if (value !== undefined) cmd.push(value);
}

// ---------------------------------------------------------------------------
// Manager Spawn Command
// ---------------------------------------------------------------------------

export function buildManagerSpawnCommand(
  runtimeName: string,
  config: PickleRickSkillsConfig,
  args: SpawnManagerArgs,
): string[] {
  const runtime = resolveRuntime(runtimeName, config);
  const cmd = buildCommandCore(runtime, args.prompt);

  appendFlag(cmd, runtime.add_dir_flag, args.extensionRoot);
  appendFlag(cmd, runtime.add_dir_flag, args.sessionDir);
  appendFlag(cmd, runtime.max_turns_flag, String(args.maxTurns));
  if (args.model) {
    appendFlag(cmd, runtime.model_flag, args.model);
  }
  if (runtime.json_output_flag) {
    // Split compound flags like '--output-format stream-json'
    cmd.push(...runtime.json_output_flag.split(/\s+/));
  }
  if (runtime.verbose_flag) {
    cmd.push(runtime.verbose_flag);
  }

  return cmd;
}

// ---------------------------------------------------------------------------
// Worker Spawn Command
// ---------------------------------------------------------------------------

export function buildWorkerSpawnCommand(
  runtimeName: string,
  config: PickleRickSkillsConfig,
  args: SpawnWorkerArgs,
): string[] {
  const runtime = resolveRuntime(runtimeName, config);
  const cmd = buildCommandCore(runtime, args.prompt);

  appendFlag(cmd, runtime.add_dir_flag, args.extensionRoot);
  appendFlag(cmd, runtime.add_dir_flag, args.ticketPath);

  return cmd;
}

// ---------------------------------------------------------------------------
// Generic Spawn Command (delegates based on arg shape)
// ---------------------------------------------------------------------------

function isManagerArgs(args: SpawnManagerArgs | SpawnWorkerArgs): args is SpawnManagerArgs {
  return 'sessionDir' in args && 'maxTurns' in args;
}

export function buildSpawnCommand(
  runtimeName: string,
  config: PickleRickSkillsConfig,
  args: SpawnManagerArgs | SpawnWorkerArgs,
): string[] {
  if (isManagerArgs(args)) {
    return buildManagerSpawnCommand(runtimeName, config, args);
  }
  return buildWorkerSpawnCommand(runtimeName, config, args);
}

// ---------------------------------------------------------------------------
// Inspection Utilities
// ---------------------------------------------------------------------------

export function formatDryRun(cmd: string[]): string {
  return cmd.map(arg => arg.includes(' ') ? `'${arg}'` : arg).join(' ');
}

export function listRuntimes(config: PickleRickSkillsConfig): string {
  const lines: string[] = [];
  for (const [name, runtime] of Object.entries(config.runtimes)) {
    const detected = runtime.detected ? 'detected' : 'not detected';
    lines.push(`  ${name} (${runtime.tier}) — ${detected}`);
  }
  return lines.join('\n');
}
