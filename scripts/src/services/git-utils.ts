import { execFileSync } from 'child_process';

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function getHeadSha(cwd: string): string {
  return runGit(['rev-parse', 'HEAD'], cwd).trim();
}

export function resetToSha(sha: string, cwd: string): void {
  runGit(['reset', '--hard', sha], cwd);
  runGit(['clean', '-fd'], cwd);
}

export function isWorkingTreeDirty(cwd: string): boolean {
  return runGit(['status', '--porcelain'], cwd).trim().length > 0;
}
