// Checks .github/CODEOWNERS against the chapters (website/docs/00-foundations/governance.md,
// "Forge settings that enforce it"): every chapter names its owner's GitHub handle in
// `owner_handle`, the last CODEOWNERS line matching the chapter (English and Italian) lists
// exactly that handle, the chapter's folder of exception records has a line of its own, the
// workflows folder and CODEOWNERS itself have an owner, and no line is malformed.
//
// GitHub skips a malformed line without failing, so this check fails on it instead. It runs
// offline on the files; it cannot see whether GitHub accepted a line or whether an owner has
// write access. Only the pattern forms the file uses are implemented: `*`, a path from the
// root to a file, and a path from the root ending in `/` (a folder and everything under it).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODEOWNERS = '.github/CODEOWNERS';
const EN_DIR = 'website/docs';
const IT_DIR = 'website/i18n/it/docusaurus-plugin-content-docs/current';
const EXCEPTIONS = 'exceptions';
const MARKDOWN = /\.mdx?$/;
const HANDLE = /^@[A-Za-z0-9][A-Za-z0-9-]*(\/[A-Za-z0-9._-]+)?$/;
const MUST_OWN = [
  { pattern: '/.github/CODEOWNERS', probe: '.github/CODEOWNERS' },
  { pattern: '/.github/workflows/', probe: '.github/workflows/verify.yml' },
];

// GitHub documents these gitignore features as unsupported in CODEOWNERS.
function unsupportedByGitHub(pattern) {
  return pattern.includes('\\#') || /[![\]]/.test(pattern);
}

function implementedForm(pattern) {
  return pattern === '*' || (pattern.startsWith('/') && !/[*?\\]/.test(pattern));
}

export function matches(pattern, file) {
  if (pattern === '*') return true;
  const p = pattern.slice(1);
  if (p.endsWith('/')) return file.startsWith(p) && file.length > p.length;
  return file === p || file.startsWith(`${p}/`);
}

export function parseCodeowners(text) {
  const rules = [];
  const problems = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const where = `${CODEOWNERS}:${i + 1}`;
    const tokens = line.split(/\s+/);
    const pattern = tokens[0];
    const comment = tokens.findIndex((t, j) => j > 0 && t.startsWith('#'));
    const owners = tokens.slice(1, comment === -1 ? undefined : comment);
    let ok = true;
    if (unsupportedByGitHub(pattern)) {
      problems.push(`${where}: pattern "${pattern}" uses !, [, ] or \\#, which are not supported by GitHub`);
      ok = false;
    } else if (!implementedForm(pattern)) {
      problems.push(`${where}: pattern "${pattern}" is a pattern form this check does not implement `
        + '(use *, /path/to/file or /path/to/folder/)');
      ok = false;
    }
    for (const owner of owners) {
      if (!owner.startsWith('@')) {
        problems.push(`${where}: owner "${owner}" does not start with @`);
        ok = false;
      } else if (!HANDLE.test(owner)) {
        problems.push(`${where}: owner "${owner}" is not a GitHub user or team handle`);
        ok = false;
      }
    }
    // GitHub skips an invalid line, so it takes no part in matching.
    if (ok) rules.push({ line: i + 1, pattern, owners });
  });
  return { rules, problems };
}

// The owners of the last line matching `file`, or null when no line matches.
export function ownersFor(rules, file) {
  for (let i = rules.length - 1; i >= 0; i -= 1) {
    if (matches(rules[i].pattern, file)) return rules[i].owners;
  }
  return null;
}

function frontmatter(text) {
  const m = /^---\r?\n(?:---|([\s\S]*?)\r?\n---)(?=\r?\n|$)/.exec(text);
  return m ? m[1] ?? '' : '';
}

function rawValue(inner, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(inner);
  if (!m) return '';
  return m[1].replace(/(^|\s+)#.*$/, '').trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}

async function listChapters(root) {
  const docs = path.join(root, EN_DIR);
  const entries = await readdir(docs, { recursive: true, withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !MARKDOWN.test(e.name)) continue;
    const rel = path.relative(docs, path.join(e.parentPath, e.name)).split(path.sep).join('/');
    if (rel.startsWith(`${EXCEPTIONS}/`)) continue;
    const fm = frontmatter(await readFile(path.join(docs, rel), 'utf8'));
    if (rawValue(fm, 'doc_type') === 'chapter') out.push({ rel, handle: rawValue(fm, 'owner_handle') });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

const show = (owners) => (owners === null ? 'no line' : owners.length ? owners.join(' ') : 'no owner');

export async function checkRepo({ root }) {
  const { rules, problems } = parseCodeowners(await readFile(path.join(root, CODEOWNERS), 'utf8'));

  for (const { pattern, probe } of MUST_OWN) {
    if (!rules.some((r) => r.pattern === pattern && r.owners.length)) {
      problems.push(`${CODEOWNERS}: no line gives ${pattern} an owner`);
    } else if (!ownersFor(rules, probe)?.length) {
      problems.push(`${CODEOWNERS}: the last line matching ${pattern} has no owner`);
    }
  }

  for (const { rel, handle } of await listChapters(root)) {
    const where = `${EN_DIR}/${rel}`;
    const want = handle.toLowerCase();
    if (!handle) problems.push(`${where}: no owner_handle in the frontmatter`);
    else {
      for (const file of [`${EN_DIR}/${rel}`, `${IT_DIR}/${rel}`]) {
        const owners = ownersFor(rules, file);
        if (!(owners?.length === 1 && owners[0].toLowerCase() === want)) {
          problems.push(`${where}: the last CODEOWNERS line matching ${file} lists ${show(owners)}, `
            + `expected exactly ${handle}`);
        }
      }
    }
    const base = rel.replace(MARKDOWN, '');
    for (const dir of [EN_DIR, IT_DIR]) {
      const folder = `${dir}/${EXCEPTIONS}/${base}/`;
      if (!rules.some((r) => r.pattern === `/${folder}`)) {
        problems.push(`${where}: no CODEOWNERS line for its folder of exception records /${folder}`);
      } else if (handle) {
        const owners = ownersFor(rules, `${folder}record.md`);
        if (!owners?.some((o) => o.toLowerCase() === want)) {
          problems.push(`${where}: the last CODEOWNERS line matching /${folder} lists ${show(owners)}, `
            + `which leaves out ${handle}`);
        }
      }
    }
  }
  return problems;
}

export async function main(argv, opts = {}) {
  const { root = '.', log = console.log, error = console.error } = opts;
  if (argv.length) {
    error('usage: codeowners.mjs');
    return 2;
  }
  let problems;
  try {
    problems = await checkRepo({ root });
  } catch (e) {
    error(`codeowners: cannot read the files: ${e.message}`);
    return 1;
  }
  for (const p of problems) log(p);
  if (!problems.length) log('codeowners OK');
  return problems.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
