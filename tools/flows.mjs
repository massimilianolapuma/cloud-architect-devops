import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFlow } from '../website/src/components/FlowExplorer/flow-schema.mjs';

const DEFAULT_DIR = 'website/src/data/flows';

export async function checkFlows(dir = DEFAULT_DIR) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const errors = [];
  for (const f of files) {
    let data;
    try {
      data = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    } catch (err) {
      errors.push(`${f}: invalid JSON (${err.message})`);
      continue;
    }
    for (const e of validateFlow(data)) errors.push(`${f}: ${e}`);
  }
  return { count: files.length, errors };
}

export async function main(dir = DEFAULT_DIR) {
  const { count, errors } = await checkFlows(dir);
  for (const e of errors) console.log(e);
  if (errors.length) return 1;
  console.log(`flows OK (${count})`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (err) {
    console.error(err.code === 'ENOENT' ? `directory not found: ${DEFAULT_DIR}` : err.message);
    process.exitCode = 1;
  }
}
