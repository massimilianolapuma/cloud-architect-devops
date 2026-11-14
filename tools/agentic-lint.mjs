import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

// The agentic chain the saved workflows rely on. Names must match the files.
export const EXPECTED = {
  skills: ['guideline-chapter', 'adr-author', 'drawio-diagram', 'interactive-diagram', 'reference-impl', 'bilingual-sync'],
  agents: ['researcher', 'architect-author', 'diagrammer', 'impl-builder', 'verifier', 'adversarial-reviewer', 'translator'],
  workflows: ['topic-design.js', 'topic-build.js'],
};

const SKILLS_DIR = '.claude/skills';
const AGENTS_DIR = '.claude/agents';
const WORKFLOWS_DIR = '.claude/workflows';

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// Lists directory entries, or returns null when the directory does not exist.
async function list(rootDir, rel) {
  try {
    return await readdir(path.join(rootDir, ...rel.split('/')), { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function readText(rootDir, rel) {
  try {
    return await readFile(path.join(rootDir, ...rel.split('/')), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Frontmatter checks shared by skills and agents: name, description, name === expected id.
function checkFrontmatter(text, rel, id, idKind) {
  let data;
  try {
    // An options object bypasses gray-matter's cache.
    ({ data } = matter(text, {}));
  } catch (e) {
    return [`${rel}: invalid frontmatter: ${e.reason ?? e.message}`];
  }
  const errors = [];
  if (isBlank(data.name)) errors.push(`${rel}: missing frontmatter field "name"`);
  else if (String(data.name) !== id) {
    errors.push(`${rel}: frontmatter name "${data.name}" does not match ${idKind} "${id}"`);
  }
  if (isBlank(data.description)) errors.push(`${rel}: missing frontmatter field "description"`);
  return errors;
}

const missingDir = (dir, expected) => `${dir}: directory not found (expected ${expected.join(', ')})`;

async function lintSkills(rootDir) {
  const entries = await list(rootDir, SKILLS_DIR);
  if (!entries) return [missingDir(SKILLS_DIR, EXPECTED.skills)];
  const errors = [];
  const present = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const found = new Set();
  for (const dir of present) {
    const rel = `${SKILLS_DIR}/${dir}/SKILL.md`;
    const text = await readText(rootDir, rel);
    if (text === null) {
      if (!EXPECTED.skills.includes(dir)) errors.push(`${rel}: missing SKILL.md`);
      continue;
    }
    found.add(dir);
    errors.push(...checkFrontmatter(text, rel, dir, 'directory'));
  }
  for (const s of EXPECTED.skills) {
    if (!found.has(s)) errors.push(`${SKILLS_DIR}/${s}/SKILL.md: missing expected skill "${s}"`);
  }
  return errors;
}

async function lintAgents(rootDir) {
  const entries = await list(rootDir, AGENTS_DIR);
  if (!entries) return [missingDir(AGENTS_DIR, EXPECTED.agents)];
  const errors = [];
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort();
  const found = new Set();
  for (const file of files) {
    const id = file.replace(/\.md$/, '');
    const rel = `${AGENTS_DIR}/${file}`;
    found.add(id);
    errors.push(...checkFrontmatter(await readText(rootDir, rel), rel, id, 'file name'));
  }
  for (const a of EXPECTED.agents) {
    if (!found.has(a)) errors.push(`${AGENTS_DIR}/${a}.md: missing expected agent "${a}"`);
  }
  return errors;
}

async function lintWorkflows(rootDir) {
  const entries = await list(rootDir, WORKFLOWS_DIR);
  if (!entries) return [missingDir(WORKFLOWS_DIR, EXPECTED.workflows)];
  const errors = [];
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.js')).map((e) => e.name).sort();
  for (const file of files) {
    const rel = `${WORKFLOWS_DIR}/${file}`;
    const text = (await readText(rootDir, rel)).replace(/^﻿/, '');
    if (!text.trimStart().startsWith('export const meta')) {
      errors.push(`${rel}: must start with "export const meta"`);
    }
  }
  for (const w of EXPECTED.workflows) {
    if (!files.includes(w)) errors.push(`${WORKFLOWS_DIR}/${w}: missing expected workflow "${w}"`);
  }
  return errors;
}

export async function lintAgentic(rootDir) {
  return [
    ...(await lintSkills(rootDir)),
    ...(await lintAgents(rootDir)),
    ...(await lintWorkflows(rootDir)),
  ];
}

export async function main(rootDir = '.') {
  const lines = await lintAgentic(rootDir);
  for (const l of lines) console.log(l);
  if (!lines.length) console.log('agentic lint OK');
  return lines.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
