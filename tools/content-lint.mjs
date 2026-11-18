import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const DEFAULT_EN_DIR = 'website/docs';
const DEFAULT_IT_DIR = 'website/i18n/it/docusaurus-plugin-content-docs/current';
const MARKDOWN = /\.mdx?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ADR_NAME = /^\d{4}-[a-z0-9]+(-[a-z0-9]+)*\.mdx?$/;
// A GitHub username, or an organisation team, with a leading @.
const HANDLE = /^@[A-Za-z0-9](?:-?[A-Za-z0-9])*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)?$/;
const EXCEPTION_ID = /^exc-\d{4}$/;
const EXCEPTION_PATH = /^exceptions\/([^/]+)\/([^/]+)\/([^/]+)$/;
const EXCEPTION_MAX_MONTHS = 6;
// Statuses for which the approver and the approval date must be filled in.
const APPROVED_STATUSES = ['approved', 'closed', 'replaced'];

// The document contract. Skills and agents rely on these values.
// Field rules: 'present' (non-empty), 'date' (non-empty YYYY-MM-DD), a list of
// allowed values, 'handle' (@user or @org/team), and 'optional' / 'optional-date'
// (the key must be there, the value may be empty).
export const CONTRACT = {
  chapter: {
    fields: {
      owner: 'present',
      owner_handle: 'handle',
      status: ['draft', 'reviewed', 'approved'],
      last_reviewed: 'date',
    },
    sections: {
      en: ['Understand', 'Decide', 'Copy', 'Verification status'],
      it: ['Capire', 'Decidere', 'Copiare', 'Stato di verifica'],
    },
  },
  adr: {
    fields: {
      status: ['proposed', 'accepted', 'superseded'],
      date: 'date',
      deciders: 'present',
    },
    sections: {
      en: ['Context and Problem Statement', 'Considered Options', 'Decision Outcome'],
      it: ['Contesto e problema', 'Opzioni considerate', 'Decisione'],
    },
  },
  exception: {
    fields: {
      id: 'present',
      title: 'present',
      guideline: 'present',
      scope: 'present',
      category: ['waiver', 'mitigated'],
      status: ['proposed', 'approved', 'rejected', 'withdrawn', 'closed', 'replaced'],
      requested_by: 'present',
      requested_on: 'date',
      approved_by: 'optional',
      approved_on: 'optional-date',
      expires: 'date',
      replaces: 'optional',
      restricted_ref: 'optional',
    },
    sections: {
      en: ['Reason', 'Risk', 'Compensating control', 'Plan to comply', 'Platform objects'],
      it: ['Motivo', 'Rischio', 'Controllo compensativo', 'Piano di conformità', 'Oggetti di piattaforma'],
    },
  },
  page: { fields: {}, sections: { en: [], it: [] } },
};

// YAML turns an unquoted 2026-11-10 into a Date (and silently rolls impossible
// dates over), so a date is validated as written in the file, not as parsed.
function rawValue(rawFrontmatter, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(rawFrontmatter);
  if (!m) return undefined;
  return m[1].replace(/(^|\s+)#.*$/, '').replace(/^(["'])(.*)\1$/, '$2');
}

function isRealDate(text) {
  const m = DATE.exec(text);
  if (!m) return false;
  const [y, mo, d] = text.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// YYYY-MM-DD plus n calendar months; a day past the end of the target month
// becomes its last day (2026-08-31 + 6 months = 2027-02-28).
function addMonths(text, n) {
  const [y, mo, d] = text.split('-').map(Number);
  const months = mo - 1 + n;
  const ty = y + Math.floor(months / 12);
  const tm = months % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const pad = (v, w = 2) => String(v).padStart(w, '0');
  return `${pad(ty, 4)}-${pad(tm + 1)}-${pad(Math.min(d, last))}`;
}

// H2 headings outside fenced code blocks, trimmed.
function h2Headings(body) {
  const out = [];
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const m = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}

// options.chapters: the set of chapter paths under the docs root, without
// extension (for example "00-foundations/docs-as-code"). When given, an
// exception record must sit in the folder of one of them.
export function lintDoc(text, locale, relPath, options = {}) {
  let parsed;
  try {
    // An options object bypasses gray-matter's cache, which drops `.matter` on repeat calls.
    parsed = matter(text, {});
  } catch (e) {
    return [`invalid frontmatter: ${e.reason ?? e.message}`];
  }
  const { data, content } = parsed;
  const docType = data.doc_type;
  if (isBlank(docType)) return ['missing frontmatter field "doc_type"'];
  const rules = Object.hasOwn(CONTRACT, docType) ? CONTRACT[docType] : null;
  if (!rules) {
    return [`unknown doc_type "${docType}" (allowed: ${Object.keys(CONTRACT).join(', ')})`];
  }

  const errors = [];
  for (const [field, rule] of Object.entries(rules.fields)) {
    const isDate = rule === 'date' || rule === 'optional-date';
    const optional = rule === 'optional' || rule === 'optional-date';
    const value = isDate ? rawValue(parsed.matter, field) : data[field];
    if (optional && !Object.hasOwn(data, field)) {
      errors.push(`missing frontmatter field "${field}"`);
    } else if (isBlank(value)) {
      if (!optional) errors.push(`missing frontmatter field "${field}"`);
    } else if (Array.isArray(rule) && !rule.includes(String(value))) {
      errors.push(`invalid ${field} "${value}" (allowed: ${rule.join(', ')})`);
    } else if (isDate && !isRealDate(String(value))) {
      errors.push(`invalid ${field} "${value}" (expected YYYY-MM-DD)`);
    } else if (rule === 'handle' && !HANDLE.test(String(value))) {
      errors.push(`invalid ${field} "${value}" (expected @user or @org/team)`);
    }
  }
  if (docType === 'exception') {
    for (const field of ['approved_by', 'approved_on']) {
      if (APPROVED_STATUSES.includes(String(data.status)) && Object.hasOwn(data, field) && isBlank(data[field])) {
        errors.push(`${field} is required when status is "${data.status}"`);
      }
    }
  }

  const present = new Set(h2Headings(content));
  for (const section of rules.sections[locale] ?? []) {
    if (!present.has(section)) errors.push(`missing section "${section}"`);
  }

  const rel = relPath.split(/[\\/]/).join('/');
  const inAdrDir = path.posix.dirname(rel) === 'adr';
  if (docType === 'adr' && !inAdrDir) {
    errors.push('ADR must live directly in adr/ (website/docs/adr/NNNN-kebab-title.md)');
  }
  if (docType === 'chapter' && inAdrDir) {
    errors.push('doc_type "chapter" is not allowed in adr/ (only adr or page)');
  }
  if (docType === 'adr') {
    const base = relPath.split(/[\\/]/).pop();
    if (!ADR_NAME.test(base)) {
      errors.push(`ADR file name "${base}" must match NNNN-kebab-title.md`);
    }
  }
  if (rel.startsWith('exceptions/') && docType !== 'exception' && docType !== 'page') {
    errors.push(`doc_type "${docType}" is not allowed in exceptions/ (only exception or page)`);
  }
  if (docType === 'exception') errors.push(...lintException(data, parsed.matter, rel, options));
  return errors;
}

// Rules of an exception record beyond its fields and sections. None of them
// reads today's date: the result depends on the files alone.
function lintException(data, rawFrontmatter, rel, { chapters } = {}) {
  const errors = [];
  const id = isBlank(data.id) ? null : String(data.id);
  const place = EXCEPTION_PATH.exec(rel);
  if (!place) {
    errors.push(`exception must live at exceptions/<section>/<chapter>/<id>.md (found ${rel})`);
  }
  if (id !== null && !EXCEPTION_ID.test(id)) {
    errors.push(`invalid id "${id}" (expected exc- and four digits, for example exc-0001)`);
  }
  const base = rel.split('/').pop();
  if (id !== null && base !== `${id}.md`) {
    errors.push(`exception file name "${base}" must be "${id}.md" (<id>.md)`);
  }

  if (place) {
    const folder = `${place[1]}/${place[2]}`;
    if (!isBlank(data.guideline)) {
      const token = String(data.guideline).trim().split(/\s+/)[0];
      if (token !== folder) {
        errors.push(`guideline must start with "${folder}", the folder of the record (found "${token}")`);
      }
    }
    if (chapters && !chapters.has(folder)) {
      errors.push(`guideline "${folder}" is not a chapter under the docs root (${folder}.md or .mdx)`);
    }
  }

  const date = (field) => {
    const v = rawValue(rawFrontmatter, field);
    return !isBlank(v) && isRealDate(v) ? v : null;
  };
  const requested = date('requested_on');
  const approved = date('approved_on');
  const expires = date('expires');
  if (approved) {
    if (requested && requested > approved) {
      errors.push(`requested_on ${requested} is after approved_on ${approved}`);
    }
    if (expires) {
      const latest = addMonths(approved, EXCEPTION_MAX_MONTHS);
      if (expires < approved) {
        errors.push(`expires ${expires} is before approved_on ${approved}`);
      } else if (expires > latest) {
        errors.push(
          `expires ${expires} is more than ${EXCEPTION_MAX_MONTHS} months after approved_on ${approved} (latest allowed: ${latest})`,
        );
      }
    }
  }

  if (!isBlank(data.restricted_ref)) {
    const ref = String(data.restricted_ref).trim();
    if (ref.includes('://') || /^www\./i.test(ref)) {
      errors.push(`restricted_ref "${ref}" must be an identifier, not a URL`);
    }
  }
  if (!isBlank(data.replaces)) {
    const replaces = String(data.replaces).trim();
    if (!EXCEPTION_ID.test(replaces)) {
      errors.push(`invalid replaces "${replaces}" (expected the id of another record, for example exc-0001)`);
    } else if (replaces === id) {
      errors.push(`replaces "${replaces}" must name another record, not this one`);
    }
  }
  return errors;
}

async function listMarkdown(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && MARKDOWN.test(e.name))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

function frontmatterOf(text) {
  try {
    return matter(text, {}).data;
  } catch {
    return null;
  }
}

// Paths (without extension) of the documents with doc_type chapter under dir.
async function listChapters(dir) {
  let files;
  try {
    files = await listMarkdown(dir);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return undefined;
  }
  const chapters = new Set();
  for (const rel of files) {
    const data = frontmatterOf(await readFile(path.join(dir, rel), 'utf8'));
    if (data?.doc_type === 'chapter') chapters.add(rel.replace(MARKDOWN, ''));
  }
  return chapters;
}

// Rules across the exception records of one docs root: unique ids, and
// `replaces` naming an existing record.
function crossCheckExceptions(records) {
  const errors = new Map();
  const add = (rel, err) => errors.set(rel, [...(errors.get(rel) ?? []), err]);
  const byId = new Map();
  for (const r of records) byId.set(r.id, [...(byId.get(r.id) ?? []), r.rel]);
  for (const r of records) {
    const others = byId.get(r.id).filter((rel) => rel !== r.rel);
    if (others.length) add(r.rel, `duplicate exception id "${r.id}" (also in ${others.join(', ')})`);
    if (r.replaces && EXCEPTION_ID.test(r.replaces) && r.replaces !== r.id && !byId.has(r.replaces)) {
      add(r.rel, `replaces "${r.replaces}" is not an existing exception record`);
    }
  }
  return errors;
}

// Exception records in every dir are checked against the chapters of
// chapterRoot, the English docs root by default.
export async function lintDirs(dirs, { chapterRoot = dirs.find(([, l]) => l === 'en')?.[0] } = {}) {
  const chapters = chapterRoot ? await listChapters(chapterRoot) : undefined;
  const lines = [];
  for (const [dir, locale] of dirs) {
    let files;
    try {
      files = await listMarkdown(dir);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      lines.push(`${dir}: directory not found`);
      continue;
    }
    const perFile = new Map();
    const records = [];
    for (const rel of files) {
      const text = await readFile(path.join(dir, rel), 'utf8');
      perFile.set(rel, lintDoc(text, locale, rel, { chapters }));
      const data = frontmatterOf(text);
      if (data?.doc_type === 'exception' && !isBlank(data.id)) {
        records.push({ rel, id: String(data.id), replaces: isBlank(data.replaces) ? null : String(data.replaces).trim() });
      }
    }
    const cross = crossCheckExceptions(records);
    for (const rel of files) {
      for (const err of [...perFile.get(rel), ...(cross.get(rel) ?? [])]) {
        lines.push(`${dir}/${rel}: ${err}`);
      }
    }
  }
  return lines;
}

export async function main(
  dirs = [[DEFAULT_EN_DIR, 'en'], [DEFAULT_IT_DIR, 'it']],
) {
  const lines = await lintDirs(dirs);
  for (const l of lines) console.log(l);
  if (!lines.length) console.log('content lint OK');
  return lines.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
