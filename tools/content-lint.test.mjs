import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lintDoc, lintDirs } from './content-lint.mjs';

const chapterEn = (over = {}, body) => {
  const fm = {
    doc_type: 'chapter',
    owner: 'team',
    owner_handle: "'@massilp'",
    status: 'draft',
    last_reviewed: '2026-11-10',
    ...over,
  };
  const lines = Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body ?? '## Understand\n\n## Decide\n\n## Copy\n\n## Verification status\n'}`;
};

const EXC_REL = 'exceptions/00-foundations/docs-as-code/exc-0001.md';
const EXC_BODY = {
  en: '## Reason\n\n## Risk\n\n## Compensating control\n\n## Plan to comply\n\n## Platform objects\n',
  it: '## Motivo\n\n## Rischio\n\n## Controllo compensativo\n\n## Piano di conformità\n\n## Oggetti di piattaforma\n',
};
// A valid approved record; `undefined` drops a key, '' leaves it present and empty.
const exception = (over = {}, locale = 'en') => {
  const fm = {
    doc_type: 'exception',
    id: 'exc-0001',
    title: 'Restore of one tenant by point-in-time restore',
    guideline: '00-foundations/docs-as-code "every change goes through a pull request"',
    scope: 'the documentation site of one team',
    category: 'waiver',
    status: 'approved',
    requested_by: 'Jane Requester',
    requested_on: '2026-11-01',
    approved_by: 'Massimiliano La Puma',
    approved_on: '2026-11-10',
    expires: '2027-05-10',
    replaces: '',
    restricted_ref: '',
    ...over,
  };
  const lines = Object.entries(fm)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => (v === '' ? `${k}:` : `${k}: ${v}`));
  return `---\n${lines.join('\n')}\n---\n\n${EXC_BODY[locale]}`;
};
const lintExc = (over, opts) => lintDoc(exception(over), 'en', EXC_REL, opts);

test('every template passes its own lint', async () => {
  const chapters = new Set(['SECTION/CHAPTER']);
  const files = [
    ['templates/chapter.en.md', 'en', 'templates/chapter.en.md'],
    ['templates/chapter.it.md', 'it', 'templates/chapter.it.md'],
    ['templates/adr.en.md', 'en', 'adr/0000-template.md'],
    ['templates/adr.it.md', 'it', 'adr/0000-template.md'],
    ['templates/exception.en.md', 'en', 'exceptions/SECTION/CHAPTER/exc-0000.md'],
    ['templates/exception.it.md', 'it', 'exceptions/SECTION/CHAPTER/exc-0000.md'],
  ];
  for (const [file, locale, rel] of files) {
    const text = await readFile(file, 'utf8');
    assert.deepEqual(lintDoc(text, locale, rel, { chapters }), [], file);
  }
});

test('chapter without owner_handle fails', () => {
  assert.deepEqual(lintDoc(chapterEn({ owner_handle: undefined }), 'en', 'c.md'), [
    'missing frontmatter field "owner_handle"',
  ]);
});

for (const good of ["'@massilp'", '"@my-org/docs_team"', "'@a1'"]) {
  test(`owner_handle ${good} passes`, () => {
    assert.deepEqual(lintDoc(chapterEn({ owner_handle: good }), 'en', 'c.md'), []);
  });
}

for (const bad of ['massilp', "'@'", "'@-massilp'", "'@org/'", "'@org/team/x'", "'@mass ilp'", "'https://github.com/massilp'"]) {
  test(`owner_handle ${bad} fails`, () => {
    const errs = lintDoc(chapterEn({ owner_handle: bad }), 'en', 'c.md');
    assert.equal(errs.length, 1, errs.join('\n'));
    assert.match(errs[0], /invalid owner_handle .*@user or @org\/team/);
  });
}

test('a valid approved exception passes', () => {
  assert.deepEqual(lintExc(), []);
});

test('a proposed exception may leave approver, approval date, replaces and restricted_ref empty', () => {
  for (const status of ['proposed', 'rejected', 'withdrawn']) {
    assert.deepEqual(lintExc({ status, approved_by: '', approved_on: '' }), [], status);
  }
});

test('a blank field followed by a YAML comment is empty, not the comment', () => {
  const errs = lintExc({
    status: 'proposed',
    approved_by: '            # filled in by the approver',
    approved_on: '            # filled in by the approver',
  });
  assert.deepEqual(errs, []);
});

test('approved, closed and replaced exceptions need approved_by and approved_on', () => {
  for (const status of ['approved', 'closed', 'replaced']) {
    const errs = lintExc({ status, approved_by: '', approved_on: '' });
    assert.deepEqual(errs, [
      `approved_by is required when status is "${status}"`,
      `approved_on is required when status is "${status}"`,
    ], status);
  }
});

test('every exception field must be present, even an optional one', () => {
  for (const field of ['id', 'scope', 'requested_on', 'approved_by', 'approved_on', 'expires', 'replaces', 'restricted_ref']) {
    const errs = lintExc({ status: 'proposed', approved_by: '', approved_on: '', [field]: undefined });
    assert.ok(errs.includes(`missing frontmatter field "${field}"`), `${field}: ${errs.join('\n')}`);
  }
});

test('expires is mandatory', () => {
  assert.ok(lintExc({ expires: '' }).includes('missing frontmatter field "expires"'));
});

test('exception category and status take only the listed values', () => {
  assert.match(lintExc({ category: 'accepted' }).join('\n'), /invalid category "accepted" \(allowed: waiver, mitigated\)/);
  assert.match(lintExc({ status: 'expired' }).join('\n'), /invalid status "expired" \(allowed: proposed, approved, rejected, withdrawn, closed, replaced\)/);
});

test('exception dates must be real dates as written', () => {
  for (const [field, bad] of [['requested_on', '2026-02-30'], ['approved_on', '"2026-13-01"'], ['expires', '2027-5-10']]) {
    const errs = lintExc({ [field]: bad });
    assert.ok(
      errs.some((e) => e.startsWith(`invalid ${field} "${bad.replaceAll('"', '')}"`)),
      `${field}: ${errs.join('\n')}`,
    );
  }
});

test('exception without its sections names each one, in each language', () => {
  const noBody = exception().replace(EXC_BODY.en, '');
  assert.deepEqual(lintDoc(noBody, 'en', EXC_REL), [
    'missing section "Reason"',
    'missing section "Risk"',
    'missing section "Compensating control"',
    'missing section "Plan to comply"',
    'missing section "Platform objects"',
  ]);
  assert.deepEqual(lintDoc(exception({}, 'it'), 'it', EXC_REL), []);
  assert.equal(lintDoc(exception(), 'it', EXC_REL).length, 5);
});

test('expires may be up to 6 calendar months after approved_on and no later', () => {
  assert.deepEqual(lintExc({ approved_on: '2026-01-15', requested_on: '2026-01-15', expires: '2026-07-15' }), []);
  assert.deepEqual(lintExc({ approved_on: '2026-01-15', requested_on: '2026-01-15', expires: '2026-07-16' }), [
    'expires 2026-07-16 is more than 6 months after approved_on 2026-01-15 (latest allowed: 2026-07-15)',
  ]);
});

test('6 months after the end of a month is the end of the shorter month', () => {
  const base = { requested_on: '2026-08-31', approved_on: '2026-08-31' };
  assert.deepEqual(lintExc({ ...base, expires: '2027-02-28' }), []);
  assert.match(lintExc({ ...base, expires: '2027-03-01' }).join('\n'), /latest allowed: 2027-02-28/);
});

test('expires before approved_on fails', () => {
  assert.deepEqual(lintExc({ expires: '2026-11-09' }), ['expires 2026-11-09 is before approved_on 2026-11-10']);
});

test('requested_on after approved_on fails', () => {
  assert.deepEqual(lintExc({ requested_on: '2026-11-11' }), ['requested_on 2026-11-11 is after approved_on 2026-11-10']);
});

test('an exception that lapsed long ago, or ends far ahead, still passes: the lint never reads today', () => {
  const past = { requested_on: '2001-01-01', approved_on: '2001-01-02', expires: '2001-07-02' };
  assert.deepEqual(lintExc(past), []);
  assert.deepEqual(lintExc({ status: 'proposed', approved_by: '', approved_on: '', expires: '2099-12-31' }), []);
});

test('exception id is exc- and four digits, and the file is named <id>.md', () => {
  for (const bad of ['EXC-0001', 'exc-001', 'exc-00001', 'exception-1']) {
    assert.ok(
      lintExc({ id: bad }).includes(`invalid id "${bad}" (expected exc- and four digits, for example exc-0001)`),
      bad,
    );
  }
  const errs = lintDoc(exception({ id: 'exc-0002' }), 'en', EXC_REL);
  assert.deepEqual(errs, ['exception file name "exc-0001.md" must be "exc-0002.md" (<id>.md)']);
  assert.match(
    lintDoc(exception(), 'en', 'exceptions/00-foundations/docs-as-code/exc-0001.mdx').join('\n'),
    /must be "exc-0001\.md"/,
  );
});

test('an exception may live only at exceptions/<section>/<chapter>/<id>.md', () => {
  for (const rel of ['exc-0001.md', 'adr/exc-0001.md', 'exceptions/exc-0001.md', 'exceptions/docs-as-code/exc-0001.md', 'exceptions/a/b/c/exc-0001.md', '00-foundations/docs-as-code/exc-0001.md']) {
    assert.match(
      lintDoc(exception(), 'en', rel).join('\n'),
      /exception must live at exceptions\/<section>\/<chapter>\/<id>\.md/,
      rel,
    );
  }
});

test('a chapter or ADR may not live under exceptions/, a page may', () => {
  assert.match(lintDoc(chapterEn(), 'en', 'exceptions/c.md').join('\n'), /"chapter" is not allowed in exceptions\//);
  const adr = '---\ndoc_type: adr\nstatus: proposed\ndate: 2026-11-10\ndeciders: t\n---\n## Context and Problem Statement\n## Considered Options\n## Decision Outcome\n';
  assert.match(lintDoc(adr, 'en', 'exceptions/a/b/0001-a.md').join('\n'), /"adr" is not allowed in exceptions\//);
  assert.deepEqual(lintDoc('---\ndoc_type: page\n---\n# Register\n', 'en', 'exceptions/index.md'), []);
});

test('the record folder must match the first token of guideline', () => {
  assert.deepEqual(lintExc({ guideline: '00-foundations/governance "a rule"' }), [
    'guideline must start with "00-foundations/docs-as-code", the folder of the record (found "00-foundations/governance")',
  ]);
  assert.match(lintExc({ guideline: '"00-foundations/docs-as-code-x the rule"' }).join('\n'), /guideline must start with/);
  assert.deepEqual(lintExc({ guideline: '00-foundations/docs-as-code' }), []);
});

test('the guideline must be an existing chapter when the chapters are known', () => {
  assert.deepEqual(lintExc({}, { chapters: new Set(['00-foundations/docs-as-code']) }), []);
  assert.deepEqual(lintExc({}, { chapters: new Set(['00-foundations/governance']) }), [
    'guideline "00-foundations/docs-as-code" is not a chapter under the docs root (00-foundations/docs-as-code.md or .mdx)',
  ]);
});

test('restricted_ref is an identifier, never a URL', () => {
  assert.deepEqual(lintExc({ restricted_ref: 'exc-0001' }), []);
  for (const bad of ['https://github.com/org/private/blob/main/exc-0001.md', 'ssh://git@host/x', 'www.example.com/exc-0001', 'WWW.example.com']) {
    assert.deepEqual(lintExc({ restricted_ref: `'${bad}'` }), [
      `restricted_ref "${bad}" must be an identifier, not a URL`,
    ], bad);
  }
});

test('replaces, when set, must be an exception id', () => {
  assert.deepEqual(lintExc({ replaces: 'exc-0001' }), ['replaces "exc-0001" must name another record, not this one']);
  assert.match(lintExc({ replaces: 'the old one' }).join('\n'), /invalid replaces "the old one"/);
});

async function withDocs(files, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'content-lint-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const p = path.join(root, rel);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, content);
    }
    await fn((rel) => path.join(root, rel));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const itChapter = chapterEn({}, '## Capire\n\n## Decidere\n\n## Copiare\n\n## Stato di verifica\n');

test('lintDirs: a record for a chapter that does not exist fails, in both languages', async () => {
  await withDocs({
    'en/00-foundations/governance.md': chapterEn(),
    [`en/${EXC_REL}`]: exception(),
    'it/00-foundations/governance.md': itChapter,
    [`it/${EXC_REL}`]: exception({}, 'it'),
  }, async (p) => {
    const lines = await lintDirs([[p('en'), 'en'], [p('it'), 'it']]);
    assert.deepEqual(lines, [
      `${p('en')}/${EXC_REL}: guideline "00-foundations/docs-as-code" is not a chapter under the docs root (00-foundations/docs-as-code.md or .mdx)`,
      `${p('it')}/${EXC_REL}: guideline "00-foundations/docs-as-code" is not a chapter under the docs root (00-foundations/docs-as-code.md or .mdx)`,
    ]);
  });
});

test('lintDirs: the Italian record is checked against the English chapters', async () => {
  await withDocs({
    'en/00-foundations/docs-as-code.mdx': chapterEn(),
    [`en/${EXC_REL}`]: exception(),
    [`it/${EXC_REL}`]: exception({}, 'it'),
  }, async (p) => {
    assert.deepEqual(await lintDirs([[p('en'), 'en'], [p('it'), 'it']]), []);
  });
});

test('lintDirs: exception ids are unique across all records', async () => {
  const other = 'exceptions/00-foundations/governance/exc-0001.md';
  await withDocs({
    'en/00-foundations/docs-as-code.mdx': chapterEn(),
    'en/00-foundations/governance.md': chapterEn(),
    [`en/${EXC_REL}`]: exception(),
    [`en/${other}`]: exception({ guideline: '00-foundations/governance "a rule"' }),
  }, async (p) => {
    assert.deepEqual(await lintDirs([[p('en'), 'en']]), [
      `${p('en')}/${EXC_REL}: duplicate exception id "exc-0001" (also in ${other})`,
      `${p('en')}/${other}: duplicate exception id "exc-0001" (also in ${EXC_REL})`,
    ]);
  });
});

test('lintDirs: replaces must name another existing record', async () => {
  const renewal = 'exceptions/00-foundations/docs-as-code/exc-0002.md';
  const files = (replaces) => ({
    'en/00-foundations/docs-as-code.mdx': chapterEn(),
    [`en/${EXC_REL}`]: exception({ status: 'replaced' }),
    [`en/${renewal}`]: exception({ id: 'exc-0002', replaces }),
  });
  await withDocs(files('exc-0001'), async (p) => {
    assert.deepEqual(await lintDirs([[p('en'), 'en']]), []);
  });
  await withDocs(files('exc-0009'), async (p) => {
    assert.deepEqual(await lintDirs([[p('en'), 'en']]), [
      `${p('en')}/${renewal}: replaces "exc-0009" is not an existing exception record`,
    ]);
  });
});

test('missing doc_type is an error', () => {
  const errs = lintDoc('---\ntitle: x\n---\n# x\n', 'en', 'a.md');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /doc_type/);
});

test('unknown doc_type is an error', () => {
  const errs = lintDoc('---\ndoc_type: essay\n---\n', 'en', 'a.md');
  assert.match(errs.join('\n'), /unknown doc_type "essay"/);
});

test('chapter without "Verification status" names that section', () => {
  const errs = lintDoc(chapterEn({}, '## Understand\n\n## Decide\n\n## Copy\n'), 'en', 'c.md');
  assert.deepEqual(errs, ['missing section "Verification status"']);
});

test('a heading inside a fenced code block does not count', () => {
  const body = '## Understand\n\n## Decide\n\n## Copy\n\n```md\n## Verification status\n```\n';
  assert.match(lintDoc(chapterEn({}, body), 'en', 'c.md').join('\n'), /Verification status/);
});

test('IT chapter with English headings fails', () => {
  const errs = lintDoc(chapterEn(), 'it', 'c.md');
  for (const s of ['Capire', 'Decidere', 'Copiare', 'Stato di verifica']) {
    assert.ok(errs.some((e) => e.includes(`"${s}"`)), s);
  }
});

test('chapter with status "done" fails and lists allowed values', () => {
  const errs = lintDoc(chapterEn({ status: 'done' }), 'en', 'c.md');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /draft, reviewed, approved/);
});

test('last_reviewed "10/11/2026" fails', () => {
  const errs = lintDoc(chapterEn({ last_reviewed: '"10/11/2026"' }), 'en', 'c.md');
  assert.match(errs.join('\n'), /last_reviewed.*YYYY-MM-DD/);
});

test('ADR file named "first-adr.md" fails the NNNN-kebab rule', () => {
  const adr = '---\ndoc_type: adr\nstatus: proposed\ndate: 2026-11-10\ndeciders: team\n---\n## Context and Problem Statement\n## Considered Options\n## Decision Outcome\n';
  assert.match(lintDoc(adr, 'en', 'adr/first-adr.md').join('\n'), /NNNN-kebab-title\.md/);
  assert.deepEqual(lintDoc(adr, 'en', 'adr/0001-first-adr.md'), []);
});

test('doc_type page has no structural rules', () => {
  assert.deepEqual(lintDoc('---\ndoc_type: page\n---\n# Hi\n', 'en', 'p.md'), []);
});

test('unquoted valid date passes', () => {
  assert.deepEqual(lintDoc(chapterEn({ last_reviewed: '2026-11-10' }), 'en', 'c.md'), []);
});

for (const bad of ['2026-13-45', '"2026-13-45"', '2026-02-30']) {
  test(`impossible date ${bad} fails naming key and value`, () => {
    const errs = lintDoc(chapterEn({ last_reviewed: bad }), 'en', 'c.md');
    assert.equal(errs.length, 1);
    assert.match(errs[0], /last_reviewed/);
    assert.ok(errs[0].includes(bad.replaceAll('"', '')), errs[0]);
  });
}

test('impossible ADR date fails', () => {
  const adr = '---\ndoc_type: adr\nstatus: proposed\ndate: 2026-02-30\ndeciders: t\n---\n## Context and Problem Statement\n## Considered Options\n## Decision Outcome\n';
  assert.match(lintDoc(adr, 'en', 'adr/0001-a.md').join('\n'), /date.*2026-02-30/);
});

test('main reports a missing directory without throwing', async () => {
  const { main } = await import('./content-lint.mjs');
  const logs = [];
  const orig = console.log;
  console.log = (l) => logs.push(l);
  let code;
  try {
    code = await main([['nope-dir', 'en']]);
  } finally {
    console.log = orig;
  }
  assert.equal(code, 1);
  assert.deepEqual(logs, ['nope-dir: directory not found']);
});

test('ADR outside adr/ is an error naming the location', () => {
  const adr = '---\ndoc_type: adr\nstatus: proposed\ndate: 2026-11-10\ndeciders: t\n---\n## Context and Problem Statement\n## Considered Options\n## Decision Outcome\n';
  assert.match(lintDoc(adr, 'en', 'topics/0001-a.md').join('\n'), /adr\//);
  assert.match(lintDoc(adr, 'en', '0001-a.md').join('\n'), /adr\//);
});

test('chapter inside adr/ is an error, page is allowed', () => {
  assert.match(lintDoc(chapterEn(), 'en', 'adr/c.md').join('\n'), /adr\//);
  assert.deepEqual(lintDoc('---\ndoc_type: page\n---\n# Index\n', 'en', 'adr/index.md'), []);
});
