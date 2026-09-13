import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

async function main(): Promise<void> {
  try {
    const { stdout } = await exec('git', ['diff', '--exit-code', '--stat', 'fixtures/'], {
      cwd: ROOT,
    });
    process.stdout.write(stdout);
    process.stdout.write('fixtures in sync with HEAD\n');
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    process.stderr.write('fixture drift detected\n');
    process.exit(1);
  }
}

void main();