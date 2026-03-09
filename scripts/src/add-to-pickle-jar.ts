import * as path from 'path';
import { addToJar } from './services/jar-utils.js';

function main(args: string[]): void {
  if (args.length < 2) {
    console.error('Usage: node add-to-pickle-jar.js <prd-path> "<task description>"');
    process.exit(1);
  }

  const prdPath = args[0];
  const task = args.slice(1).join(' ');

  try {
    const jarTask = addToJar(prdPath, task);
    console.log(`Task queued: ${jarTask.id}`);
    console.log(`PRD: ${jarTask.prd_path}`);
    console.log(`Run \`node scripts/bin/jar-runner.js\` to execute.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === 'add-to-pickle-jar.js') {
  main(process.argv.slice(2));
}
