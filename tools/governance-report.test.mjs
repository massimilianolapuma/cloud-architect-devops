import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { main } from './governance-report.mjs';

const EXC = 'website/docs/exceptions/00-foundations/governance';

async function withRepo(files, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'governance-report-'));
  try {
    await mkdir(path.join(root, 'website/docs'), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const p = path.join(root, rel);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, content);
    }
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

// Runs main and returns its exit code and every line it printed.
async function run(root, argv = [], today = '2026-11-18') {
  const lines = [];
  const errors = [];
  const code = await main(argv, {
    root,
    today,
    log: (l) => lines.push(l),
    error: (l) => errors.push(l),
  });
  return { code, lines, errors, out: lines.join('\n') };
}

function record(over = {}, platformObjects = 'None.') {
  const fm = {
    doc_type: 'exception',
    id: 'EXC-0001',
    title: 'A deviation',
    guideline: '00-foundations/governance, "must review every 6 months"',
    scope: 'the database tier of one workload',
    category: 'waiver',
    status: 'approved',
    requested_by: 'Ada Requester',
    requested_on: '2026-09-01',
    approved_by: 'Bob Approver',
    approved_on: '2026-09-02',
    expires: '2027-03-01',
    replaces: '',
    restricted_ref: '',
    ...over,
  };
  const lines = Object.entries(fm)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  return [
    '---',
    ...lines,
    '---',
    '',
    '## Reason',
    '',
    'A secret reason nobody may read.',
    '',
    '## Platform objects',
    '',
    platformObjects,
    '',
  ].join('\n');
}

const chapter = (lastReviewed, over = '') =>
  `---\ndoc_type: chapter\ntitle: T\nowner: Someone\nstatus: draft\nlast_reviewed: ${lastReviewed}\n${over}---\n\n## Understand\n`;

const linesOf = (out, kind) => out.split('\n').filter((l) => l.startsWith(`${kind} `));

test('an approved record whose expiry has passed is listed as lapsed', async () => {
  await withRepo({ [`${EXC}/EXC-0001.md`]: record({ expires: '2026-11-17' }) }, async (root) => {
    const r = await run(root);
    assert.equal(r.code, 0);
    const l = linesOf(r.out, 'lapsed');
    assert.equal(l.length, 1);
    assert.match(l[0], /EXC-0001/);
    assert.match(l[0], /expires 2026-11-17/);
  });
});

test('an approved record lapsing within 30 days is listed; one lapsing later is not', async () => {
  await withRepo(
    {
      [`${EXC}/EXC-0001.md`]: record({ id: 'EXC-0001', expires: '2026-11-18' }),
      [`${EXC}/EXC-0002.md`]: record({ id: 'EXC-0002', expires: '2026-12-18' }),
      [`${EXC}/EXC-0003.md`]: record({ id: 'EXC-0003', expires: '2026-12-19' }),
    },
    async (root) => {
      const r = await run(root);
      assert.equal(r.code, 0);
      assert.deepEqual(linesOf(r.out, 'lapsed'), []);
      const l = linesOf(r.out, 'lapsing').join('\n');
      assert.match(l, /EXC-0001/);
      assert.match(l, /EXC-0002/);
      assert.doesNotMatch(l, /EXC-0003/);
    },
  );
});

test('records that are not approved are never listed as lapsed or lapsing', async () => {
  const files = {};
  for (const [i, status] of ['proposed', 'rejected', 'withdrawn', 'closed', 'replaced'].entries()) {
    files[`${EXC}/EXC-000${i}.md`] = record({ id: `EXC-000${i}`, status, expires: '2026-11-01' });
    files[`${EXC}/SOON-000${i}.md`] = record({ id: `SOON-000${i}`, status, expires: '2026-11-20' });
  }
  await withRepo(files, async (root) => {
    const r = await run(root);
    assert.equal(r.code, 0);
    assert.deepEqual(linesOf(r.out, 'lapsed'), []);
    assert.deepEqual(linesOf(r.out, 'lapsing'), []);
  });
});

test('lapsed or closed records that name platform objects are listed', async () => {
  await withRepo(
    {
      [`${EXC}/LAPSED-OBJ.md`]: record({ id: 'LAPSED-OBJ', expires: '2026-10-01' }, 'An Azure Policy exemption; delete it.'),
      [`${EXC}/CLOSED-OBJ.md`]: record({ id: 'CLOSED-OBJ', status: 'closed' }, 'A Kyverno PolicyException.'),
      [`${EXC}/ACTIVE-OBJ.md`]: record({ id: 'ACTIVE-OBJ' }, 'An Azure Policy exemption.'),
      [`${EXC}/LAPSED-NONE.md`]: record({ id: 'LAPSED-NONE', expires: '2026-10-01' }, 'None'),
      [`${EXC}/CLOSED-NONEDOT.md`]: record({ id: 'CLOSED-NONEDOT', status: 'closed' }, 'none.'),
      [`${EXC}/CLOSED-EMPTY.md`]: record({ id: 'CLOSED-EMPTY', status: 'closed' }, ''),
      [`${EXC}/CLOSED-COMMENT.md`]: record({ id: 'CLOSED-COMMENT', status: 'closed' }, '<!-- nothing yet -->'),
    },
    async (root) => {
      const r = await run(root);
      assert.equal(r.code, 0);
      const l = linesOf(r.out, 'platform-objects').join('\n');
      assert.match(l, /LAPSED-OBJ/);
      assert.match(l, /CLOSED-OBJ/);
      for (const id of ['ACTIVE-OBJ', 'LAPSED-NONE', 'CLOSED-NONEDOT', 'CLOSED-EMPTY', 'CLOSED-COMMENT']) {
        assert.doesNotMatch(l, new RegExp(id));
      }
    },
  );
});

test('a heading inside a fenced code block is not a section', async () => {
  const text = record({ id: 'FENCED', status: 'closed' }, 'None').replace(
    'A secret reason nobody may read.',
    '```text\n## Platform objects\n\nAn Azure Policy exemption.\n```',
  );
  await withRepo({ [`${EXC}/FENCED.md`]: text }, async (root) => {
    const r = await run(root);
    assert.deepEqual(linesOf(r.out, 'platform-objects'), []);
  });
});

test('active records approved by their own requester are listed', async () => {
  await withRepo(
    {
      [`${EXC}/SELF.md`]: record({ id: 'SELF', requested_by: 'Ada Lovelace', approved_by: ' ada  lovelace ' }),
      [`${EXC}/OTHER.md`]: record({ id: 'OTHER', requested_by: 'Ada Lovelace', approved_by: 'Bob' }),
      [`${EXC}/SELF-LAPSED.md`]: record({
        id: 'SELF-LAPSED', requested_by: 'Ada', approved_by: 'Ada', expires: '2026-10-01',
      }),
      [`${EXC}/SELF-PROPOSED.md`]: record({ id: 'SELF-PROPOSED', status: 'proposed', requested_by: 'Ada', approved_by: 'Ada' }),
      [`${EXC}/BLANK.md`]: record({ id: 'BLANK', status: 'proposed', requested_by: '', approved_by: '' }),
    },
    async (root) => {
      const r = await run(root);
      assert.equal(r.code, 0);
      const l = linesOf(r.out, 'self-approved');
      assert.equal(l.length, 1);
      assert.match(l[0], /SELF/);
      assert.match(l[0], /approved 2026-09-02/);
    },
  );
});

test('an approved record without a real expiry date is listed', async () => {
  await withRepo(
    {
      [`${EXC}/NODATE.md`]: record({ id: 'NODATE', expires: '' }),
      [`${EXC}/BADDATE.md`]: record({ id: 'BADDATE', expires: '2027-02-30' }),
    },
    async (root) => {
      const r = await run(root);
      assert.equal(r.code, 0);
      const l = linesOf(r.out, 'no-expiry').join('\n');
      assert.match(l, /NODATE/);
      assert.match(l, /BADDATE/);
    },
  );
});

test('a chapter reviewed more than 6 calendar months ago is listed', async () => {
  await withRepo(
    {
      'website/docs/s/old.md': chapter('2026-05-17'),
      'website/docs/s/edge.md': chapter('2026-05-18'),
      'website/docs/s/new.mdx': chapter('2026-11-01'),
      'website/docs/adr/0001-x.md': '---\ndoc_type: adr\nstatus: accepted\ndate: 2020-01-01\ndeciders: x\n---\n',
      'website/docs/intro.mdx': '---\ndoc_type: page\nlast_reviewed: 2020-01-01\n---\n',
    },
    async (root) => {
      const r = await run(root);
      assert.equal(r.code, 0);
      const l = linesOf(r.out, 'review-overdue');
      assert.equal(l.length, 1);
      assert.match(l[0], /website\/docs\/s\/old\.md/);
      assert.match(l[0], /last_reviewed 2026-05-17/);
    },
  );
});

test('six calendar months from the end of a month clamp to the end of the target month', async () => {
  await withRepo({ 'website/docs/s/c.md': chapter('2026-08-31') }, async (root) => {
    assert.deepEqual(linesOf((await run(root, [], '2027-02-28')).out, 'review-overdue'), []);
    assert.equal(linesOf((await run(root, [], '2027-03-01')).out, 'review-overdue').length, 1);
  });
});

test('a chapter without a real last_reviewed date is listed', async () => {
  await withRepo({ 'website/docs/s/c.md': chapter('soon') }, async (root) => {
    const r = await run(root);
    assert.equal(r.code, 0);
    assert.equal(linesOf(r.out, 'no-review-date').length, 1);
  });
});

test('with no exception records the chapters are still reported', async () => {
  await withRepo({ 'website/docs/s/old.md': chapter('2025-01-01') }, async (root) => {
    const r = await run(root);
    assert.equal(r.code, 0);
    assert.equal(linesOf(r.out, 'review-overdue').length, 1);
    assert.match(r.lines.at(-1), /0 records/);
    assert.match(r.lines.at(-1), /1 chapter/);
  });
});

test('the output never holds the scope, reason, names or other fields of a record', async () => {
  await withRepo(
    {
      [`${EXC}/LEAK.md`]: record(
        {
          id: 'LEAK',
          requested_by: 'Zelda Requester',
          approved_by: 'Zelda Requester',
          scope: 'SECRET-SCOPE',
          title: 'SECRET-TITLE',
          guideline: 'SECRET-GUIDELINE',
          category: 'mitigated',
          restricted_ref: 'SECRET-REF',
          expires: '2026-11-20',
        },
        'SECRET-PLATFORM-OBJECT',
      ),
      [`${EXC}/LEAK2.md`]: record(
        { id: 'LEAK2', status: 'closed', requested_by: 'Zelda Requester' },
        'SECRET-PLATFORM-OBJECT',
      ),
    },
    async (root) => {
      const r = await run(root);
      assert.equal(r.code, 0);
      assert.ok(r.lines.length > 2, r.out);
      for (const secret of ['Zelda', 'SECRET', 'secret reason', 'mitigated', 'waiver', 'closed']) {
        assert.doesNotMatch(r.out, new RegExp(secret, 'i'), secret);
      }
    },
  );
});

test('the last line is a summary of what was found and read', async () => {
  await withRepo(
    {
      [`${EXC}/A.md`]: record({ id: 'A', expires: '2026-11-01' }, 'An exemption.'),
      'website/docs/s/c.md': chapter('2026-11-01'),
    },
    async (root) => {
      const r = await run(root);
      const last = r.lines.at(-1);
      assert.match(last, /2026-11-18/);
      assert.match(last, /1 lapsed/);
      assert.match(last, /0 lapsing/);
      assert.match(last, /1 with platform objects/);
      assert.match(last, /0 self-approved/);
      assert.match(last, /0 chapters overdue/);
      assert.match(last, /1 record\b/);
    },
  );
});

test('--today on the command line sets the date', async () => {
  await withRepo({ [`${EXC}/A.md`]: record({ id: 'A', expires: '2026-12-01' }) }, async (root) => {
    const r = await run(root, ['--today', '2026-12-02'], undefined);
    assert.equal(r.code, 0);
    assert.equal(linesOf(r.out, 'lapsed').length, 1);
  });
});

test('without a date the report uses the current local date', async () => {
  await withRepo({}, async (root) => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const r = await run(root, [], undefined);
    assert.equal(r.code, 0);
    assert.match(r.lines.at(-1), new RegExp(today));
  });
});

test('a usage error exits 2', async () => {
  await withRepo({}, async (root) => {
    for (const argv of [['--today'], ['--today', '2026-02-30'], ['--today', '18/11/2026'], ['--verbose']]) {
      const r = await run(root, argv, undefined);
      assert.equal(r.code, 2, argv.join(' '));
      assert.match(r.errors.join('\n'), /usage/);
    }
  });
});

test('an unreadable docs folder exits 1', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'governance-report-'));
  try {
    const r = await run(root);
    assert.equal(r.code, 1);
    assert.ok(r.errors.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
