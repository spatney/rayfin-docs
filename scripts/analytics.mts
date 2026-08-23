/**
 * Traffic summary for the deployed docs site.
 *
 * Reads the Azure Static Web Apps `SiteHits` / `BytesSent` / `SiteErrors` metrics, which
 * count **every** request — including the `.md` mirrors, `llms.txt` and `AGENTS.md` that
 * agents fetch and that client-side analytics can never see, because static text files
 * do not execute JavaScript.
 *
 * The trade-off: these metrics are aggregate. Azure Static Web Apps exposes no per-request
 * logs on this tier (its diagnostic-settings category list is empty), so traffic cannot be
 * broken down by path or user agent from Azure alone. For the human share, compare these
 * totals against pageviews in Microsoft Clarity.
 *
 *   npm run analytics            # last 7 days
 *   npm run analytics -- --days 30
 */
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCallback);

const SUBSCRIPTION = '57a3a6e5-037c-4ae2-97a3-2ec2e02c461a';
const RESOURCE_ID = `/subscriptions/${SUBSCRIPTION}/resourceGroups/rayfin-docs/providers/Microsoft.Web/staticSites/rayfin-docs`;

type Point = { timeStamp: string; total?: number };

const days = Number(argValue('--days') ?? 7);
if (!Number.isFinite(days) || days < 1) {
  throw new Error('--days must be a positive number');
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

/**
 * Always request hourly buckets between an explicit start and end. Azure collapses the
 * whole window into a single empty bucket when the range is open-ended or the grain is
 * coarser than the data, so days are aggregated here instead.
 *
 * Runs through a shell because the Azure CLI is a `.cmd` shim on Windows, which Node
 * refuses to spawn directly. Every interpolated value is a module constant or the
 * numeric `days` argument validated above — nothing here is free-form input.
 */
async function metric(name: string, startIso: string, endIso: string): Promise<Point[]> {
  const command = [
    'az monitor metrics list',
    `--resource "${RESOURCE_ID}"`,
    `--subscription "${SUBSCRIPTION}"`,
    `--metric "${name}"`,
    '--interval PT1H',
    '--aggregation Total',
    `--start-time "${startIso}"`,
    `--end-time "${endIso}"`,
    '-o json',
  ].join(' ');

  const { stdout } = await exec(command, { maxBuffer: 1024 * 1024 * 32 });

  const parsed = JSON.parse(stdout);
  return parsed?.value?.[0]?.timeseries?.[0]?.data ?? [];
}

function sum(points: Point[]): number {
  return points.reduce((acc, p) => acc + (p.total ?? 0), 0);
}

function byDay(points: Point[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of points) {
    const day = p.timeStamp.slice(0, 10);
    out.set(day, (out.get(day) ?? 0) + (p.total ?? 0));
  }
  return out;
}

function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function bar(value: number, max: number, width = 34): string {
  if (max <= 0 || value <= 0) return '';
  return '█'.repeat(Math.max(1, Math.round((value / max) * width)));
}

async function main() {
  const now = new Date();
  const end = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const startDate = new Date(now.getTime() - (days - 1) * 86_400_000);
  const start = `${startDate.toISOString().slice(0, 10)}T00:00:00Z`;

  const [hits, sent, errors] = await Promise.all([
    metric('SiteHits', start, end),
    metric('BytesSent', start, end),
    metric('SiteErrors', start, end),
  ]);

  const daily = byDay(hits);
  const totalHits = sum(hits);
  const peak = Math.max(...daily.values(), 0);

  console.log(`\n  rayfin.ai — requests, last ${days} day(s)\n`);

  for (const [day, value] of [...daily].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${day}  ${String(value).padStart(7)}  ${bar(value, peak)}`);
  }

  console.log('\n  ──────────────────────────────────────────────────');
  console.log(`  Requests        ${String(totalHits).padStart(9)}`);
  console.log(`  Errors          ${String(sum(errors)).padStart(9)}`);
  console.log(`  Transferred     ${bytes(sum(sent)).padStart(9)}`);
  console.log(`  Daily average   ${String(Math.round(totalHits / days)).padStart(9)}`);

  console.log(
    [
      '',
      '  Counts every request, agents included — the .md mirrors, llms.txt and',
      '  AGENTS.md that never run JavaScript. Azure exposes no per-path breakdown',
      '  on this tier, so for the human share compare against pageviews in',
      '  Microsoft Clarity: https://clarity.microsoft.com',
      '',
    ].join('\n'),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|not recognized/i.test(message)) {
    console.error('The Azure CLI is required. Install it, then run `az login`.');
  } else if (/az login|AADSTS|not logged in|Please run/i.test(message)) {
    console.error('Not signed in to Azure. Run `az login` and try again.');
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
