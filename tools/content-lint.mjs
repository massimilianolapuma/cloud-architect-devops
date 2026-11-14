import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const DEFAULT_EN_DIR = 'website/docs';
const DEFAULT_IT_DIR = 'website/i18n/it/docusaurus-plugin-content-docs/current';
const MARKDOWN = /\.mdx?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ADR_NAME = /^\d{4}-[a-z0-9]+(-[a-z0-9]+)*\.mdx?$/;

// The document contract. Skills and agents rely on these values.
export const CONTRACT = {
  chapter: {
    fields: {
      owner: 'present',
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
  page: { fields: {}, sections: { en: [], it: [] } },
};

// YAML turns an unquoted 2026-11-10 into a Date (and silently rolls impossible
// dates over), so a date is validated as written in the file, not as parsed.
function rawValue(rawFrontmatter, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(rawFrontmatter);
  if (!m) return undefined;
  return m[1].replace(/\s+#.*$/, '').replace(/^(["'])(.*)\1$/, '$2');
}

function isRealDate(text) {
  const m = DATE.exec(text);
  if (!m) return false;
  const [y, mo, d] = text.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

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

export function lintDoc(text, locale, relPath) {
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
    const value = rule === 'date' ? rawValue(parsed.matter, field) : data[field];
    if (isBlank(value)) {
      errors.push(`missing frontmatter field "${field}"`);
    } else if (Array.isArray(rule) && !rule.includes(String(value))) {
      errors.push(`invalid ${field} "${value}" (allowed: ${rule.join(', ')})`);
    } else if (rule === 'date' && !isRealDate(String(value))) {
      errors.push(`invalid ${field} "${value}" (expected YYYY-MM-DD)`);
    }
  }

  const present = new Set(h2Headings(content));
  for (const section of rules.sections[locale] ?? []) {
    if (!present.has(section)) errors.push(`missing section "${section}"`);
  }

  const inAdrDir = path.posix.dirname(relPath.split(/[\\/]/).join('/')) === 'adr';
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
  return errors;
}

async function listMarkdown(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && MARKDOWN.test(e.name))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

export async function lintDirs(dirs) {
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
    for (const rel of files) {
      const text = await readFile(path.join(dir, rel), 'utf8');
      for (const err of lintDoc(text, locale, rel)) {
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
