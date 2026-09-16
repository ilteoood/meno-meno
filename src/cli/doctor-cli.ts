import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { cwd } from 'node:process';
import { pathToFileURL } from 'node:url';
import { runDoctor, doctorToMarkdown, type DoctorReport } from '../doctor.ts';

interface ParsedArgs {
  readonly operatore: string | null;
  readonly output: string | null;
  readonly json: boolean;
  readonly live: boolean;
}

interface ParseFailure {
  readonly exit: 2;
  readonly message: string;
}

type ParseResult = { ok: true; args: ParsedArgs } | ParseFailure;

function parseArgs(argv: readonly string[]): ParseResult {
  let operatore: string | null = null;
  let output: string | null = null;
  let json = false;
  let live = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--operatore':
        operatore = argv[++i] ?? null;
        if (operatore === null) {
          return { exit: 2, message: '--operatore requires a value' };
        }
        break;
      case '--output':
        output = argv[++i] ?? null;
        if (output === null) {
          return { exit: 2, message: '--output requires a value' };
        }
        break;
      case '--json':
        json = true;
        break;
      case '--live':
        live = true;
        break;
      case '--help':
      case '-h':
        process.stdout.write(
          'Usage: doctor [--operatore <id>] [--live] [--output <path>] [--json]\n\n--live   scrape live from operator site (default: per-operator fixture)\n',
        );
        process.exit(0);
        break;
      default:
        return { exit: 2, message: `unknown flag: ${arg}` };
    }
  }
  return { ok: true, args: { operatore, output, json, live } };
}

function defaultOutputPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve(cwd(), 'logs', `doctor-${stamp}.md`);
}

async function emitMarkdown(report: DoctorReport, output: string | null): Promise<void> {
  const md = doctorToMarkdown(report);
  const target = output ?? defaultOutputPath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, md, 'utf8');
  process.stdout.write(md);
  process.stdout.write(`\n# saved to ${target}\n`);
}

async function emitJson(report: DoctorReport, output: string | null): Promise<void> {
  const payload = JSON.stringify(report, null, 2);
  if (output !== null) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, payload + '\n');
  }
  process.stdout.write(payload + '\n');
}

async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if (!('ok' in parsed)) {
    process.stderr.write(`${parsed.message}\n`);
    return parsed.exit;
  }
  const report = await runDoctor({
    operatore: parsed.args.operatore ?? undefined,
    live: parsed.args.live,
  });
  if (parsed.args.json) {
    await emitJson(report, parsed.args.output);
  } else {
    await emitMarkdown(report, parsed.args.output);
  }
  return report.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  void main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`doctor: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
