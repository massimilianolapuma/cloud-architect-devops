import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkParity, stamp } from './i18n-parity.mjs';

async function withDirs(files, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'i18n-parity-'));
  const enDir = path.join(root, 'en');
  const itDir = path.join(root, 'it');
  try {
    for (const [side, dir] of [['en', enDir], ['it', itDir]]) {
      await mkdir(dir, { recursive: true });
      for (const [rel, content] of Object.entries(files[side] ?? {})) {
        const p = path.join(dir, rel);
        await mkdir(path.dirname(p), { recursive: true });
        await writeFile(p, content);
      }
    }
    await fn({ enDir, itDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('EN file without IT counterpart is missing', async () => {
  await withDirs({ en: { 'a/b.md': '# b\n' } }, async (d) => {
    const r = await checkParity(d);
    assert.deepEqual(r, { missing: ['a/b.md'], orphan: [], stale: [] });
  });
});

test('IT file without EN counterpart is orphan', async () => {
  await withDirs({ it: { 'old.md': '# old\n' } }, async (d) => {
    const r = await checkParity(d);
    assert.deepEqual(r, { missing: [], orphan: ['old.md'], stale: [] });
  });
});

test('IT file with no source_sha256 is stale', async () => {
  await withDirs({ en: { 'a.md': '# a\n' }, it: { 'a.md': '---\ndoc_type: page\n---\n# a\n' } }, async (d) => {
    const r = await checkParity(d);
    assert.deepEqual(r, { missing: [], orphan: [], stale: ['a.md'] });
  });
});

test('after stamp the pair is clean', async () => {
  await withDirs({ en: { 'a.md': '# a\n' }, it: { 'a.md': '# a it\n' } }, async (d) => {
    await stamp({ ...d, relPath: 'a.md' });
    assert.deepEqual(await checkParity(d), { missing: [], orphan: [], stale: [] });
  });
});

test('editing EN after stamp makes the pair stale again', async () => {
  await withDirs({ en: { 'a.md': '# a\n' }, it: { 'a.md': '# a it\n' } }, async (d) => {
    await stamp({ ...d, relPath: 'a.md' });
    await writeFile(path.join(d.enDir, 'a.md'), '# a changed\n');
    assert.deepEqual(await checkParity(d), { missing: [], orphan: [], stale: ['a.md'] });
  });
});

test('stamp keeps the IT body and other frontmatter keys byte-identical', async () => {
  const body = '\n# Titolo\n\nTesto con "virgolette"  e spazi finali  \n---\nnon frontmatter\n';
  const fm = "---\ntitle:   'Introduzione'\ndoc_type: page\nslug: /\n";
  await withDirs({ en: { 'a.md': '# a\n' }, it: { 'a.md': `${fm}---\n${body}` } }, async (d) => {
    await stamp({ ...d, relPath: 'a.md' });
    const first = await readFile(path.join(d.itDir, 'a.md'), 'utf8');
    assert.ok(first.startsWith(fm));
    assert.ok(first.endsWith(`---\n${body}`));
    assert.match(first, /\nsource_sha256: [0-9a-f]{64}\n/);
    // restamping replaces the line instead of adding a second one
    await writeFile(path.join(d.enDir, 'a.md'), '# changed\n');
    await stamp({ ...d, relPath: 'a.md' });
    const second = await readFile(path.join(d.itDir, 'a.md'), 'utf8');
    assert.equal(second.match(/source_sha256/g).length, 1);
    assert.ok(second.startsWith(fm));
    assert.ok(second.endsWith(`---\n${body}`));
    assert.notEqual(first, second);
  });
});

test('stamp on an IT file without frontmatter adds a block with only that key', async () => {
  await withDirs({ en: { 'a.md': '# a\n' }, it: { 'a.md': '# corpo\n' } }, async (d) => {
    await stamp({ ...d, relPath: 'a.md' });
    const out = await readFile(path.join(d.itDir, 'a.md'), 'utf8');
    assert.match(out, /^---\nsource_sha256: [0-9a-f]{64}\n---\n# corpo\n$/);
  });
});

test('paths with spaces and non-ASCII characters work', async () => {
  const rel = 'città multi tenant.md';
  await withDirs({ en: { [rel]: '# tenant\n' }, it: { [rel]: '# tenant it\n' } }, async (d) => {
    await stamp({ ...d, relPath: rel });
    assert.deepEqual(await checkParity(d), { missing: [], orphan: [], stale: [] });
  });
});

test('non-markdown files are ignored', async () => {
  await withDirs(
    { en: { '_category_.json': '{}', 'img.png': 'x', 'a.mdx': '# a\n' }, it: { 'z.png': 'y', '_category_.json': '{}' } },
    async (d) => {
      assert.deepEqual(await checkParity(d), { missing: ['a.mdx'], orphan: [], stale: [] });
    },
  );
});

test('stamp on an empty frontmatter block does not touch the body', async () => {
  const body = '# x\n\n---\nfoo\n';
  await withDirs({ en: { 'a.md': '# a\n' }, it: { 'a.md': `---\n---\n${body}` } }, async (d) => {
    await stamp({ ...d, relPath: 'a.md' });
    const out = await readFile(path.join(d.itDir, 'a.md'), 'utf8');
    assert.match(out, /^---\nsource_sha256: [0-9a-f]{64}\n---\n/);
    assert.ok(out.endsWith(`---\n${body}`));
    assert.equal(out.match(/source_sha256/g).length, 1);
    assert.deepEqual(await checkParity(d), { missing: [], orphan: [], stale: [] });
  });
});
