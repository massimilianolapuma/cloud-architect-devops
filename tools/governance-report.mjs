// The dated report of the governance chapter (website/docs/00-foundations/governance.md).
//
// It lists exception records that have lapsed or lapse within 30 days, lapsed or closed
// records that still name platform objects, active records approved by their own requester,
// and chapters past their 6-month review interval. The repository is public, so it prints
// only record identifiers, paths and dates, never any other field of a record.
//
// It depends on today's date, so it always exits 0 when it could read the files: it must
// never fail a merge. It exits 2 on a usage error and 1 on a file it cannot read.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = 'website/docs';
const EXCEPTIONS_SUBDIR = 'exceptions';
const MARKDOWN = /\.mdx?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WARNING_DAYS = 30;
const REVIEW_MONTHS = 6;
const USAGE = 'usage: governance-report.mjs [--today YYYY-MM-DD]';

async function listMarkdown(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && MARKDOWN.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

function frontmatter(text) {
  const m = /^---\r?\n(?:---|([\s\S]*?)\r?\n---)(?=\r?\n|$)/.exec(text);
  return m ? { inner: m[1] ?? '', end: m[0].length } : { inner: '', end: 0 };
}

// A value as written in the frontmatter: YAML would turn an unquoted date into a Date and
// roll an impossible date over, so values are read as text. A trailing comment is dropped.
function rawValue(inner, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(inner);
  if (!m) return '';
  return m[1].replace(/(^|\s+)#.*$/, '').trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}

function isRealDate(text) {
  if (!DATE.test(text)) return false;
  const [y, mo, d] = text.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

const toUtc = (text) => {
  const [y, mo, d] = text.split('-').map(Number);
  return Date.UTC(y, mo - 1, d);
};

const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);

function addDays(text, days) {
  return fmt(toUtc(text) + days * 86_400_000);
}

// Calendar months; a day that does not exist in the target month clamps to its last day.
function addMonths(text, months) {
  const [y, mo, d] = text.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return fmt(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)));
}

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The body of the H2 section `title`, outside fenced code blocks; null when absent.
function section(body, title) {
  const out = [];
  let inside = false;
  let found = false;
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
    } else if (!fence) {
      const h = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
      if (h) {
        inside = h[1].trim() === title;
        found ||= inside;
        continue;
      }
    }
    if (inside) out.push(line);
  }
  return found ? out.join('\n') : null;
}

// A section names no platform object when it is missing, empty, or says "None".
function namesPlatformObjects(body) {
  const text = (section(body, 'Platform objects') ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
  return text !== '' && !/^none\.?$/i.test(text);
}

const samePerson = (a, b) => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
};

export async function buildReport({ root, today }) {
  const docsDir = path.join(root, DOCS_DIR);
  const excDir = path.join(docsDir, EXCEPTIONS_SUBDIR);
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  const items = [];
  const counts = { records: 0, chapters: 0 };

  const files = await listMarkdown(docsDir);
  const warnUntil = addDays(today, WARNING_DAYS);
  const reviewedSince = addMonths(today, -REVIEW_MONTHS);

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const fm = frontmatter(text);
    const type = rawValue(fm.inner, 'doc_type');
    const inExceptions = !path.relative(excDir, file).startsWith('..');

    if (type === 'exception' && inExceptions) {
      counts.records += 1;
      const id = rawValue(fm.inner, 'id') || path.basename(file).replace(MARKDOWN, '');
      const who = `${id} ${rel(file)}`;
      const status = rawValue(fm.inner, 'status');
      const expires = rawValue(fm.inner, 'expires');
      const validExpiry = isRealDate(expires);
      const approved = status === 'approved';
      const lapsed = approved && validExpiry && expires < today;
      if (approved && !validExpiry) items.push({ kind: 'no-expiry', line: who });
      if (lapsed) items.push({ kind: 'lapsed', line: `${who} expires ${expires}` });
      if (approved && validExpiry && expires >= today && expires <= warnUntil) {
        items.push({ kind: 'lapsing', line: `${who} expires ${expires}` });
      }
      if ((lapsed || status === 'closed') && namesPlatformObjects(text.slice(fm.end))) {
        const date = validExpiry ? ` expires ${expires}` : '';
        items.push({ kind: 'platform-objects', line: `${who}${date}` });
      }
      if (approved && !lapsed && samePerson(rawValue(fm.inner, 'requested_by'), rawValue(fm.inner, 'approved_by'))) {
        const on = rawValue(fm.inner, 'approved_on');
        items.push({ kind: 'self-approved', line: isRealDate(on) ? `${who} approved ${on}` : who });
      }
    } else if (type === 'chapter' && !inExceptions) {
      counts.chapters += 1;
      const lr = rawValue(fm.inner, 'last_reviewed');
      if (!isRealDate(lr)) items.push({ kind: 'no-review-date', line: rel(file) });
      else if (lr < reviewedSince) items.push({ kind: 'review-overdue', line: `${rel(file)} last_reviewed ${lr}` });
    }
  }
  return { items, counts };
}

const KINDS = ['lapsed', 'lapsing', 'no-expiry', 'platform-objects', 'self-approved', 'review-overdue', 'no-review-date'];

function parseArgs(argv) {
  let today;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--today' && i + 1 < argv.length) today = argv[++i];
    else return { error: `unknown or incomplete argument "${argv[i]}"` };
  }
  if (today !== undefined && !isRealDate(today)) return { error: `"${today}" is not a date YYYY-MM-DD` };
  return { today };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export async function main(argv, opts = {}) {
  const { root = '.', log = console.log, error = console.error } = opts;
  const args = parseArgs(argv);
  if (args.error) {
    error(args.error);
    error(USAGE);
    return 2;
  }
  const today = args.today ?? opts.today ?? localToday();
  if (!isRealDate(today)) {
    error(`"${today}" is not a date YYYY-MM-DD`);
    error(USAGE);
    return 2;
  }
  let report;
  try {
    report = await buildReport({ root, today });
  } catch (e) {
    error(`governance report: cannot read the files: ${e.message}`);
    return 1;
  }
  const n = (kind) => report.items.filter((i) => i.kind === kind).length;
  for (const kind of KINDS) {
    for (const item of report.items.filter((i) => i.kind === kind)) log(`${kind.padEnd(16)} ${item.line}`);
  }
  log(
    `governance report ${today}: ${n('lapsed')} lapsed, ${n('lapsing')} lapsing within ${WARNING_DAYS} days, `
      + `${n('no-expiry')} without a valid expiry, ${n('platform-objects')} with platform objects, `
      + `${n('self-approved')} self-approved, ${n('review-overdue')} chapters overdue, `
      + `${n('no-review-date')} without a valid review date; `
      + `read ${plural(report.counts.records, 'record')} and ${plural(report.counts.chapters, 'chapter')}`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
