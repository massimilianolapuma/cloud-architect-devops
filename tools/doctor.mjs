import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PROBE_TIMEOUT_MS = 10_000;

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

export async function checkTools(requirements, probe) {
  const results = [];
  for (const r of requirements) {
    const base = { name: r.name, required: r.required, install: r.install };
    const p = await probe(r.cmd, r.versionArgs);
    if (!p.found) {
      results.push({ ...base, status: 'missing' });
      continue;
    }
    if (!p.ok) {
      results.push({ ...base, status: 'broken' });
      continue;
    }
    const m = new RegExp(r.versionPattern).exec(p.stdout);
    if (!m) {
      results.push({ ...base, status: 'broken' });
      continue;
    }
    const version = m[1];
    const tooOld = r.min && compareVersions(version, r.min) < 0;
    results.push({ ...base, status: tooOld ? 'too-old' : 'ok', version });
  }
  return results;
}

// Real probe: never goes through a shell, and can never hang (timeout kills the child).
export function realProbe(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: PROBE_TIMEOUT_MS, killSignal: 'SIGKILL' }, (err, stdout, stderr) => {
      if (!err) return resolve({ found: true, ok: true, stdout: `${stdout}${stderr}` });
      // ENOENT from spawn means the command is not on PATH.
      if (err.code === 'ENOENT') return resolve({ found: false, ok: false, stdout: '' });
      resolve({ found: true, ok: false, stdout: '' });
    });
  });
}

// A PATH wrapper whose target is gone exits 126/127; execFile cannot tell that from
// a real failure, so both map to found: true, ok: false (broken), as intended.

export function formatResult(r) {
  if (r.status === 'ok') return `ok ${r.name} ${r.version}`;
  const label = r.required ? r.status : `warn ${r.status}`;
  return `${label} ${r.name} → ${r.install}`;
}

async function main() {
  const file = new URL('./toolchain.json', import.meta.url);
  const requirements = JSON.parse(await readFile(file, 'utf8'));
  const results = await checkTools(requirements, realProbe);
  for (const r of results) console.log(formatResult(r));
  const failed = results.filter((r) => r.required && r.status !== 'ok');
  if (failed.length) {
    console.error(`\n${failed.length} required tool(s) not ok.`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
