import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';

/**
 * Last-modified dates for docs sources, read from git history.
 *
 * Freshness is both a ranking signal and something agents weigh when deciding
 * whether documentation still describes the shipped SDK, so every `.md` mirror
 * carries a `last_updated` stamp and every sitemap entry a `<lastmod>`.
 *
 * File mtime is useless here: a CI checkout rewrites it to the clone time, which
 * would mark the whole site as modified on every deploy. Git commit time is the
 * only durable source. Note that this requires unshallow history — see
 * `fetch-depth: 0` in .github/workflows/deploy.yml.
 */
const CONTENT_DIR = 'content/docs';

let cache: Map<string, string> | null = null;

/**
 * One `git log` for the whole content tree rather than one per page.
 *
 * `--name-only` prints each commit's date followed by the paths it touched, so a
 * single newest-first pass records the first (latest) date seen per file.
 */
function buildCache(): Map<string, string> {
  const map = new Map<string, string>();

  let stdout: string;
  try {
    stdout = execFileSync(
      'git',
      ['log', '--format=%x00%cI', '--name-only', '--', CONTENT_DIR],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    // Not a git checkout, or git is unavailable. Callers fall back to mtime.
    return map;
  }

  let commitDate = '';
  for (const line of stdout.split('\n')) {
    if (line.startsWith('\0')) {
      commitDate = line.slice(1).trim();
    } else if (line.length > 0 && commitDate && !map.has(line.trim())) {
      map.set(line.trim(), commitDate);
    }
  }

  return map;
}

/**
 * ISO 8601 timestamp of the last commit touching a docs page.
 *
 * @param pagePath Source path relative to `content/docs`, i.e. fumadocs' `page.path`.
 */
export function lastModified(pagePath: string): string {
  cache ??= buildCache();

  const key = `${CONTENT_DIR}/${pagePath.split(path.sep).join('/')}`;
  const committed = cache.get(key);
  if (committed) return committed;

  try {
    return statSync(path.join(process.cwd(), key)).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Newest commit date across the whole content tree, for non-page URLs. */
export function contentLastModified(): string {
  cache ??= buildCache();

  let newest = '';
  for (const date of cache.values()) {
    if (date > newest) newest = date;
  }

  return newest || new Date().toISOString();
}
