import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { main, matches, ownersFor, parseCodeowners } from './codeowners.mjs';

const IT = 'website/i18n/it/docusaurus-plugin-content-docs/current';

async function withRepo(files, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'codeowners-'));
  try {
    await mkdir(path.join(root, 'website/docs'), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      if (content === null) continue;
      const p = path.join(root, rel);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, content);
    }
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function run(root, argv = []) {
  const lines = [];
  const errors = [];
  const code = await main(argv, { root, log: (l) => lines.push(l), error: (l) => errors.push(l) });
  return { code, lines, errors, out: lines.join('\n') };
}

const chapter = (handle) =>
  `---\ndoc_type: chapter\ntitle: T\nowner: Someone\n${handle === undefined ? '' : `owner_handle: ${handle}\n`}`
  + 'status: draft\nlast_reviewed: 2026-11-18\n---\n\n## Understand\n';

const GOOD_CODEOWNERS = [
  '# Code owners.',
  '* @massilp',
  '/.github/CODEOWNERS @massilp',
  '/.github/workflows/ @massilp',
  '/website/docs/s/ @massilp',
  `/${IT}/s/ @massilp`,
  '/website/docs/s/c.md @massilp',
  `/${IT}/s/c.md @massilp`,
  '/website/docs/exceptions/s/c/ @massilp',
  `/${IT}/exceptions/s/c/ @massilp`,
  '',
].join('\n');

const goodRepo = (over = {}) => ({
  '.github/CODEOWNERS': GOOD_CODEOWNERS,
  'website/docs/s/c.md': chapter("'@massilp'"),
  'website/docs/adr/0001-x.md': '---\ndoc_type: adr\nstatus: proposed\ndate: 2026-11-18\ndeciders: x\n---\n',
  ...over,
});

// --- matching -----------------------------------------------------------------------------

test('* matches every file', () => {
  assert.ok(matches('*', 'a.md'));
  assert.ok(matches('*', 'a/b/c.md'));
});

test('a leading-slash path matches that file, from the root only', () => {
  assert.ok(matches('/a/b.md', 'a/b.md'));
  assert.ok(!matches('/a/b.md', 'x/a/b.md'));
  assert.ok(!matches('/a/b.md', 'a/b.mdx'));
  assert.ok(!matches('/a/b.md', 'a/b.md.bak'));
});

test('a leading-slash path ending in / matches everything under that folder', () => {
  assert.ok(matches('/a/', 'a/b.md'));
  assert.ok(matches('/a/', 'a/b/c/d.md'));
  assert.ok(!matches('/a/', 'ab/c.md'));
  assert.ok(!matches('/a/', 'x/a/c.md'));
  assert.ok(!matches('/a/b/', 'a/b'));
});

test('the last matching line wins', () => {
  const { rules } = parseCodeowners('* @all\n/docs/ @docs\n/docs/x.md @x\n');
  assert.deepEqual(ownersFor(rules, 'docs/x.md'), ['@x']);
  assert.deepEqual(ownersFor(rules, 'docs/y.md'), ['@docs']);
  assert.deepEqual(ownersFor(rules, 'other.md'), ['@all']);
  const reversed = parseCodeowners('/docs/x.md @x\n/docs/ @docs\n');
  assert.deepEqual(ownersFor(reversed.rules, 'docs/x.md'), ['@docs']);
});

test('a path no line matches has no owners', () => {
  const { rules } = parseCodeowners('/docs/ @docs\n');
  assert.equal(ownersFor(rules, 'src/a.js'), null);
});

test('a line with a pattern and no owner matches and leaves the path without owners', () => {
  const { rules, problems } = parseCodeowners('* @all\n/docs/\n');
  assert.deepEqual(problems, []);
  assert.deepEqual(ownersFor(rules, 'docs/a.md'), []);
});

test('comments, blank lines and trailing comments are ignored', () => {
  const { rules, problems } = parseCodeowners('# header\n\n   \n/a/ @x @y # two owners\n');
  assert.deepEqual(problems, []);
  assert.deepEqual(rules.map((r) => [r.pattern, r.owners]), [['/a/', ['@x', '@y']]]);
});

// --- malformed lines ----------------------------------------------------------------------

test('an owner that does not start with @ is a problem, and the line is skipped', () => {
  const { rules, problems } = parseCodeowners('* @all\n/docs/ massilp\n');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^\.github\/CODEOWNERS:2: .*"massilp"/);
  assert.deepEqual(ownersFor(rules, 'docs/a.md'), ['@all']);
});

test('patterns with !, [, ] or \\# are problems', () => {
  for (const p of ['!/docs/', '/docs/[ab].md', '/docs/a].md', '/docs/\\#a.md']) {
    const { rules, problems } = parseCodeowners(`${p} @x\n`);
    assert.equal(problems.length, 1, p);
    assert.match(problems[0], /not supported by GitHub/, p);
    assert.deepEqual(rules, [], p);
  }
});

test('pattern forms this check does not implement are problems', () => {
  for (const p of ['docs/', 'docs/a.md', '/docs/*.md', '**/a.md', '/docs/a?.md', '*.md']) {
    const { problems } = parseCodeowners(`${p} @x\n`);
    assert.equal(problems.length, 1, p);
    assert.match(problems[0], /pattern form/, p);
  }
});

// --- the check on a repository ------------------------------------------------------------

test('a repository whose chapters match CODEOWNERS passes', async () => {
  await withRepo(goodRepo(), async (root) => {
    const r = await run(root);
    assert.deepEqual(r.lines, ['codeowners OK']);
    assert.equal(r.code, 0);
  });
});

test('handles are compared without regard to case', async () => {
  await withRepo(goodRepo({ 'website/docs/s/c.md': chapter("'@MassiLP'") }), async (root) => {
    assert.equal((await run(root)).code, 0);
  });
});

test('a chapter without owner_handle fails', async () => {
  await withRepo(goodRepo({ 'website/docs/s/c.md': chapter(undefined) }), async (root) => {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.deepEqual(r.lines, ['website/docs/s/c.md: no owner_handle in the frontmatter']);
  });
});

test('a chapter whose last matching line lists another owner fails', async () => {
  const co = GOOD_CODEOWNERS.replace('/website/docs/s/c.md @massilp', '/website/docs/s/c.md @someone');
  await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.equal(r.lines.length, 1);
    assert.match(r.lines[0], /^website\/docs\/s\/c\.md: .*website\/docs\/s\/c\.md.*@someone.*@massilp/);
  });
});

test('a chapter whose line lists more owners than its handle fails', async () => {
  const co = GOOD_CODEOWNERS.replace('/website/docs/s/c.md @massilp', '/website/docs/s/c.md @massilp @deputy');
  await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
    assert.equal((await run(root)).code, 1);
  });
});

test('a later line that overrides the chapter line wins and fails the check', async () => {
  const co = `${GOOD_CODEOWNERS}/website/docs/s/ @someone\n`;
  await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.match(r.out, /website\/docs\/s\/c\.md: /);
  });
});

test('the Italian mirror path is checked too', async () => {
  const co = GOOD_CODEOWNERS.replace(`/${IT}/s/c.md @massilp`, `/${IT}/s/c.md @someone`);
  await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.equal(r.lines.length, 1);
    assert.match(r.lines[0], new RegExp(`${IT}/s/c\\.md`));
  });
});

test('a chapter with no line for its folder of exception records fails, in either language', async () => {
  for (const line of ['/website/docs/exceptions/s/c/ @massilp', `/${IT}/exceptions/s/c/ @massilp`]) {
    const co = GOOD_CODEOWNERS.replace(`${line}\n`, '');
    await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
      const r = await run(root);
      assert.equal(r.code, 1, line);
      assert.equal(r.lines.length, 1, r.out);
      assert.match(r.lines[0], /exception/, line);
      assert.ok(r.lines[0].includes(line.split(' ')[0]), r.lines[0]);
    });
  }
});

test('a folder of exception records whose owners leave out the handle fails', async () => {
  const co = GOOD_CODEOWNERS.replace('/website/docs/exceptions/s/c/ @massilp', '/website/docs/exceptions/s/c/ @deputy');
  await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
    assert.equal((await run(root)).code, 1);
  });
  const withDeputy = GOOD_CODEOWNERS.replace(
    '/website/docs/exceptions/s/c/ @massilp',
    '/website/docs/exceptions/s/c/ @massilp @deputy',
  );
  await withRepo(goodRepo({ '.github/CODEOWNERS': withDeputy }), async (root) => {
    assert.equal((await run(root)).code, 0);
  });
});

test('missing owners for the workflows folder or CODEOWNERS itself fail', async () => {
  const cases = [
    GOOD_CODEOWNERS.replace('/.github/workflows/ @massilp\n', ''),
    GOOD_CODEOWNERS.replace('/.github/CODEOWNERS @massilp\n', ''),
    GOOD_CODEOWNERS.replace('/.github/CODEOWNERS @massilp', '/.github/CODEOWNERS'),
    `${GOOD_CODEOWNERS}/.github/\n`,
  ];
  for (const co of cases) {
    await withRepo(goodRepo({ '.github/CODEOWNERS': co }), async (root) => {
      const r = await run(root);
      assert.equal(r.code, 1, co);
      assert.match(r.out, /\/\.github\/(workflows\/|CODEOWNERS)/, co);
    });
  }
});

test('a malformed line fails the check', async () => {
  await withRepo(goodRepo({ '.github/CODEOWNERS': `${GOOD_CODEOWNERS}/docs/ massilp\n` }), async (root) => {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.match(r.out, /CODEOWNERS:\d+: /);
  });
});

test('documents that are not chapters need no owner_handle', async () => {
  await withRepo(goodRepo({ 'website/docs/intro.mdx': '---\ndoc_type: page\n---\n' }), async (root) => {
    assert.equal((await run(root)).code, 0);
  });
});

test('a missing CODEOWNERS file fails', async () => {
  await withRepo(goodRepo({ '.github/CODEOWNERS': null }), async (root) => {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.match(r.out + r.errors.join('\n'), /CODEOWNERS/);
  });
});

test('any argument is a usage error', async () => {
  await withRepo(goodRepo(), async (root) => {
    const r = await run(root, ['--fix']);
    assert.equal(r.code, 2);
    assert.match(r.errors.join('\n'), /usage/);
  });
});
