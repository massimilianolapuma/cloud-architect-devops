import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_EN_DIR = 'website/docs';
const DEFAULT_IT_DIR = 'website/i18n/it/docusaurus-plugin-content-docs/current';
const MARKDOWN = /\.mdx?$/;
const SHA_LINE = /^source_sha256:.*$/m;

async function listMarkdown(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && MARKDOWN.test(e.name))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Splits a leading `---` frontmatter block. Returns null when there is none.
function splitFrontmatter(text) {
  const m = /^---(\r?\n)(?:---|([\s\S]*?)\r?\n---)(?=\r?\n|$)/.exec(text);
  if (!m) return null;
  return { eol: m[1], inner: m[2] ?? '', start: 0, end: m[0].length };
}

function readStamp(text) {
  const fm = splitFrontmatter(text);
  if (!fm) return null;
  const m = /^source_sha256:\s*["']?([0-9a-fA-F]+)["']?\s*$/m.exec(fm.inner);
  return m ? m[1].toLowerCase() : null;
}

export async function checkParity({ enDir, itDir }) {
  const [en, it] = await Promise.all([listMarkdown(enDir), listMarkdown(itDir)]);
  const itSet = new Set(it);
  const enSet = new Set(en);
  const missing = en.filter((p) => !itSet.has(p));
  const orphan = it.filter((p) => !enSet.has(p));
  const stale = [];
  for (const rel of en.filter((p) => itSet.has(p))) {
    const expected = sha256(await readFile(path.join(enDir, rel)));
    const actual = readStamp(await readFile(path.join(itDir, rel), 'utf8'));
    if (actual !== expected) stale.push(rel);
  }
  return { missing, orphan, stale };
}

export async function stamp({ enDir, itDir, relPath }) {
  const hash = sha256(await readFile(path.join(enDir, relPath)));
  const itPath = path.join(itDir, relPath);
  const text = await readFile(itPath, 'utf8');
  const line = `source_sha256: ${hash}`;
  const fm = splitFrontmatter(text);
  let out;
  if (!fm) {
    out = `---\n${line}\n---\n${text}`;
  } else if (SHA_LINE.test(fm.inner)) {
    const inner = fm.inner.replace(SHA_LINE, line);
    out = text.slice(0, 3 + fm.eol.length) + inner + text.slice(3 + fm.eol.length + fm.inner.length);
  } else {
    const at = 3 + fm.eol.length + fm.inner.length;
    out = fm.inner === ''
      ? text.slice(0, at) + line + fm.eol + text.slice(at)
      : text.slice(0, at) + fm.eol + line + text.slice(at);
  }
  await writeFile(itPath, out);
}

export async function main(argv, dirs = { enDir: DEFAULT_EN_DIR, itDir: DEFAULT_IT_DIR }) {
  const [cmd, relPath] = argv;
  if (cmd === 'check') {
    const r = await checkParity(dirs);
    for (const kind of ['missing', 'orphan', 'stale']) {
      for (const p of r[kind]) console.log(`${kind.padEnd(7)} ${p}`);
    }
    const bad = r.missing.length + r.orphan.length + r.stale.length;
    if (!bad) console.log('i18n parity OK');
    return bad ? 1 : 0;
  }
  if (cmd === 'stamp' && relPath) {
    await stamp({ ...dirs, relPath });
    console.log(`stamped ${relPath}`);
    return 0;
  }
  console.error('usage: i18n-parity.mjs check | stamp <relPath>');
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
