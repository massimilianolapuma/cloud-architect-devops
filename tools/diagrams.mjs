import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SRC_DIR = 'diagrams';
const DEFAULT_OUT_DIR = 'website/static/diagrams';
const DEFAULT_MANIFEST = 'diagrams/manifest.json';
const EXPORT_TIMEOUT_MS = 60_000;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const posix = (p) => p.split(path.sep).join('/');
const exists = (p) => access(p).then(() => true, () => false);

async function listFiles(dir, ext) {
  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => posix(path.relative(dir, path.join(e.parentPath, e.name))))
    .sort();
}

const svgRel = (rel) => rel.replace(/\.drawio$/, '.svg');

export async function planExports({ srcDir, outDir, manifest }) {
  const sources = await listFiles(srcDir, '.drawio');
  const svgs = await listFiles(outDir, '.svg');
  const plan = { missing: [], stale: [], multiPage: [], orphanSvg: [] };
  const expected = new Set(sources.map(svgRel));
  for (const rel of sources) {
    const buf = await readFile(path.join(srcDir, ...rel.split('/')));
    const pages = (buf.toString('utf8').match(/<diagram[\s>]/g) ?? []).length;
    if (pages > 1) {
      plan.multiPage.push(rel);
    } else if (!(await exists(path.join(outDir, ...svgRel(rel).split('/'))))) {
      plan.missing.push(rel);
    } else if (manifest[rel] !== sha256(buf)) {
      plan.stale.push(rel);
    }
  }
  plan.orphanSvg = svgs.filter((s) => !expected.has(s));
  return plan;
}

async function readManifest(manifestPath) {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function runExport({ srcDir, outDir, manifestPath, exporter }) {
  const manifest = await readManifest(manifestPath);
  const plan = await planExports({ srcDir, outDir, manifest });
  if (plan.multiPage.length) {
    throw new Error(`one <diagram> per file; multi-page: ${plan.multiPage.join(', ')}`);
  }
  const todo = [...plan.missing, ...plan.stale].sort();
  const next = { ...manifest };
  for (const rel of todo) {
    const inPath = path.join(srcDir, ...rel.split('/'));
    const outPath = path.join(outDir, ...svgRel(rel).split('/'));
    await mkdir(path.dirname(outPath), { recursive: true });
    await exporter(inPath, outPath);
    next[rel] = sha256(await readFile(inPath));
  }
  const sources = new Set(await listFiles(srcDir, '.drawio'));
  const sorted = Object.fromEntries(
    Object.keys(next).filter((k) => sources.has(k)).sort().map((k) => [k, next[k]]),
  );
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`);
  return todo;
}

export function drawioExporter(inPath, outPath) {
  const args = ['--export', '--format', 'svg', '--embed-diagram', '--border', '10', '--theme', 'light', '--output', outPath, inPath];
  return new Promise((resolve, reject) => {
    execFile('drawio', args, { timeout: EXPORT_TIMEOUT_MS }, (err, _stdout, stderr) => {
      if (err) reject(new Error(`drawio failed for ${inPath}: ${err.message}\n${stderr ?? ''}`));
      else resolve();
    });
  });
}

export async function main(argv, opts = {}) {
  const { srcDir = DEFAULT_SRC_DIR, outDir = DEFAULT_OUT_DIR, manifestPath = DEFAULT_MANIFEST, exporter = drawioExporter } = opts;
  const [cmd] = argv;
  if (cmd === 'check') {
    const plan = await planExports({ srcDir, outDir, manifest: await readManifest(manifestPath) });
    const kinds = { missing: 'missing', stale: 'stale', multiPage: 'multipage', orphanSvg: 'orphan' };
    let bad = 0;
    for (const [key, label] of Object.entries(kinds)) {
      for (const p of plan[key]) {
        console.log(`${label} ${p}`);
        bad += 1;
      }
    }
    if (bad) return 1;
    console.log('diagrams OK');
    return 0;
  }
  if (cmd === 'export') {
    const done = await runExport({ srcDir, outDir, manifestPath, exporter });
    for (const p of done) console.log(`exported ${p}`);
    if (!done.length) console.log('nothing to export');
    return 0;
  }
  console.error('usage: diagrams.mjs check | export');
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
