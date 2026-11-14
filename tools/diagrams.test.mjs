import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planExports, runExport } from './diagrams.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const one = (label) => `<mxfile><diagram name="p">${label}</diagram></mxfile>`;
const two = '<mxfile><diagram name="a">x</diagram><diagram name="b">y</diagram></mxfile>';

async function withTree({ src = {}, out = {} }, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'diagrams-'));
  const srcDir = path.join(root, 'diagrams');
  const outDir = path.join(root, 'static', 'diagrams');
  try {
    for (const [dir, files] of [[srcDir, src], [outDir, out]]) {
      await mkdir(dir, { recursive: true });
      for (const [rel, content] of Object.entries(files)) {
        const p = path.join(dir, rel);
        await mkdir(path.dirname(p), { recursive: true });
        await writeFile(p, content);
      }
    }
    await fn({ root, srcDir, outDir, manifestPath: path.join(root, 'manifest.json') });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const fakeExporter = (calls = []) => async (inPath, outPath) => {
  calls.push([inPath, outPath]);
  await writeFile(outPath, '<svg/>');
};

const empty = { missing: [], stale: [], multiPage: [], orphanSvg: [] };

test('new .drawio with no SVG is missing', async () => {
  await withTree({ src: { 'a/new.drawio': one('x') } }, async (d) => {
    const r = await planExports({ ...d, manifest: {} });
    assert.deepEqual(r, { ...empty, missing: ['a/new.drawio'] });
  });
});

test('source changed since manifest hash is stale', async () => {
  await withTree({ src: { 'a.drawio': one('new') }, out: { 'a.svg': '<svg/>' } }, async (d) => {
    const r = await planExports({ ...d, manifest: { 'a.drawio': sha(one('old')) } });
    assert.deepEqual(r, { ...empty, stale: ['a.drawio'] });
  });
});

test('deleted SVG is missing even when the manifest hash matches', async () => {
  await withTree({ src: { 'a.drawio': one('x') } }, async (d) => {
    const r = await planExports({ ...d, manifest: { 'a.drawio': sha(one('x')) } });
    assert.deepEqual(r, { ...empty, missing: ['a.drawio'] });
  });
});

test('SVG with no source is orphanSvg', async () => {
  await withTree({ out: { 'gone/x.svg': '<svg/>' } }, async (d) => {
    const r = await planExports({ ...d, manifest: {} });
    assert.deepEqual(r, { ...empty, orphanSvg: ['gone/x.svg'] });
  });
});

test('a .drawio with two <diagram> elements is multiPage', async () => {
  await withTree({ src: { 'm.drawio': two } }, async (d) => {
    const r = await planExports({ ...d, manifest: {} });
    assert.deepEqual(r, { ...empty, multiPage: ['m.drawio'] });
  });
});

test('runExport exports only missing and stale, then plan is clean', async () => {
  await withTree({
    src: { 'ok.drawio': one('ok'), 'old.drawio': one('new'), 'fresh.drawio': one('f') },
    out: { 'ok.svg': '<svg/>', 'old.svg': '<svg/>' },
  }, async (d) => {
    await writeFile(d.manifestPath, JSON.stringify({ 'ok.drawio': sha(one('ok')), 'old.drawio': sha(one('old')) }));
    const calls = [];
    const exported = await runExport({ ...d, exporter: fakeExporter(calls) });
    assert.deepEqual(exported, ['fresh.drawio', 'old.drawio']);
    assert.equal(calls.length, 2);
    const manifest = JSON.parse(await readFile(d.manifestPath, 'utf8'));
    assert.deepEqual(Object.keys(manifest), ['fresh.drawio', 'ok.drawio', 'old.drawio']);
    assert.ok((await readFile(d.manifestPath, 'utf8')).endsWith('\n'));
    assert.deepEqual(await planExports({ ...d, manifest }), empty);
  });
});

test('paths with spaces and non-ASCII characters reach the exporter unchanged', async () => {
  await withTree({ src: { 'più cartella/è un diagramma.drawio': one('x') } }, async (d) => {
    const calls = [];
    await runExport({ ...d, exporter: fakeExporter(calls) });
    assert.deepEqual(calls, [[
      path.join(d.srcDir, 'più cartella', 'è un diagramma.drawio'),
      path.join(d.outDir, 'più cartella', 'è un diagramma.svg'),
    ]]);
    await access(calls[0][1]);
    const manifest = JSON.parse(await readFile(d.manifestPath, 'utf8'));
    assert.deepEqual(Object.keys(manifest), ['più cartella/è un diagramma.drawio']);
  });
});

test('runExport refuses to export a multiPage file', async () => {
  await withTree({ src: { 'sub/m.drawio': two, 'a.drawio': one('x') } }, async (d) => {
    const calls = [];
    await assert.rejects(runExport({ ...d, exporter: fakeExporter(calls) }), /sub\/m\.drawio/);
    assert.equal(calls.length, 0);
  });
});
