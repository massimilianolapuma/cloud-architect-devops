import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lintDoc } from './content-lint.mjs';

const chapterEn = (over = {}, body) => {
  const fm = { doc_type: 'chapter', owner: 'team', status: 'draft', last_reviewed: '2026-11-10', ...over };
  const lines = Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body ?? '## Understand\n\n## Decide\n\n## Copy\n\n## Verification status\n'}`;
};

test('every template passes its own lint', async () => {
  const files = [
    ['templates/chapter.en.md', 'en', 'templates/chapter.en.md'],
    ['templates/chapter.it.md', 'it', 'templates/chapter.it.md'],
    ['templates/adr.en.md', 'en', 'adr/0000-template.md'],
    ['templates/adr.it.md', 'it', 'adr/0000-template.md'],
  ];
  for (const [file, locale, rel] of files) {
    const text = await readFile(file, 'utf8');
    assert.deepEqual(lintDoc(text, locale, rel), [], file);
  }
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
