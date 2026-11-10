import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lintAgentic, EXPECTED } from './agentic-lint.mjs';

const skill = (name, description = `Use when testing ${name}`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;
const agent = (name, description = `Tests ${name}`) =>
  `---\nname: ${name}\ndescription: ${description}\ntools: Read\n---\n\nBody.\n`;
const workflow = 'export const meta = { name: "w" };\n';

// A complete, valid `.claude/` tree as { relPath: content }; overrides replace or delete (null).
function completeTree(overrides = {}) {
  const files = {};
  for (const s of EXPECTED.skills) files[`.claude/skills/${s}/SKILL.md`] = skill(s);
  for (const a of EXPECTED.agents) files[`.claude/agents/${a}.md`] = agent(a);
  for (const w of EXPECTED.workflows) files[`.claude/workflows/${w}`] = workflow;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete files[k];
    else files[k] = v;
  }
  return files;
}

async function withTree(files, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'agentic-lint-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const p = path.join(root, ...rel.split('/'));
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, content);
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const lint = (files) => withTree(files, (root) => lintAgentic(root));

test('a complete tree has no errors', async () => {
  assert.deepEqual(await lint(completeTree()), []);
});

test('skill whose frontmatter name differs from its directory is reported', async () => {
  const errs = await lint(completeTree({ '.claude/skills/adr-author/SKILL.md': skill('adr-writer') }));
  assert.deepEqual(errs, [
    '.claude/skills/adr-author/SKILL.md: frontmatter name "adr-writer" does not match directory "adr-author"',
  ]);
});

test('skill without description is reported', async () => {
  const errs = await lint(completeTree({
    '.claude/skills/drawio-diagram/SKILL.md': '---\nname: drawio-diagram\n---\n\n# x\n',
  }));
  assert.deepEqual(errs, ['.claude/skills/drawio-diagram/SKILL.md: missing frontmatter field "description"']);
});

test('agent without name or description is reported', async () => {
  const errs = await lint(completeTree({
    '.claude/agents/verifier.md': '---\ndescription: Runs gates\n---\n\nBody.\n',
    '.claude/agents/translator.md': '---\nname: translator\n---\n\nBody.\n',
  }));
  assert.deepEqual(errs, [
    '.claude/agents/translator.md: missing frontmatter field "description"',
    '.claude/agents/verifier.md: missing frontmatter field "name"',
  ]);
});

test('agent whose name differs from its file name is reported', async () => {
  const errs = await lint(completeTree({ '.claude/agents/verifier.md': agent('checker') }));
  assert.deepEqual(errs, ['.claude/agents/verifier.md: frontmatter name "checker" does not match file name "verifier"']);
});

test('a missing expected skill or agent is reported by name', async () => {
  const errs = await lint(completeTree({
    '.claude/skills/bilingual-sync/SKILL.md': null,
    '.claude/agents/adversarial-reviewer.md': null,
  }));
  assert.deepEqual(errs, [
    '.claude/skills/bilingual-sync/SKILL.md: missing expected skill "bilingual-sync"',
    '.claude/agents/adversarial-reviewer.md: missing expected agent "adversarial-reviewer"',
  ]);
});

test('every expected name is checked: 6 skills, 7 agents, 2 workflows', async () => {
  assert.deepEqual(EXPECTED.skills, [
    'guideline-chapter', 'adr-author', 'drawio-diagram', 'interactive-diagram', 'reference-impl', 'bilingual-sync',
  ]);
  assert.deepEqual(EXPECTED.agents, [
    'researcher', 'architect-author', 'diagrammer', 'impl-builder', 'verifier', 'adversarial-reviewer', 'translator',
  ]);
  assert.deepEqual(EXPECTED.workflows, ['topic-design.js', 'topic-build.js']);
});

test('workflow file not starting with "export const meta" is reported', async () => {
  const errs = await lint(completeTree({
    '.claude/workflows/topic-build.js': 'const meta = {};\nexport default meta;\n',
  }));
  assert.deepEqual(errs, ['.claude/workflows/topic-build.js: must start with "export const meta"']);
});

test('a missing workflow is reported by name', async () => {
  const errs = await lint(completeTree({ '.claude/workflows/topic-design.js': null }));
  assert.deepEqual(errs, ['.claude/workflows/topic-design.js: missing expected workflow "topic-design.js"']);
});

test('a missing directory gives one clear line naming what was expected', async () => {
  const files = completeTree();
  for (const k of Object.keys(files)) if (k.startsWith('.claude/workflows/')) delete files[k];
  const errs = await lint(files);
  assert.deepEqual(errs, ['.claude/workflows: directory not found (expected topic-design.js, topic-build.js)']);
});

test('invalid frontmatter is reported, not thrown', async () => {
  const errs = await lint(completeTree({ '.claude/agents/researcher.md': '---\nname: [unclosed\n---\n' }));
  assert.equal(errs.length, 1);
  assert.match(errs[0], /^\.claude\/agents\/researcher\.md: invalid frontmatter/);
});

test('main prints one line per error and returns 1, or an OK line and 0', async () => {
  const { main } = await import('./agentic-lint.mjs');
  const run = async (files) => withTree(files, async (root) => {
    const logs = [];
    const orig = console.log;
    console.log = (l) => logs.push(l);
    try {
      return { code: await main(root), logs };
    } finally {
      console.log = orig;
    }
  });
  assert.deepEqual(await run(completeTree()), { code: 0, logs: ['agentic lint OK'] });
  const bad = await run(completeTree({ '.claude/agents/verifier.md': null }));
  assert.equal(bad.code, 1);
  assert.deepEqual(bad.logs, ['.claude/agents/verifier.md: missing expected agent "verifier"']);
});
