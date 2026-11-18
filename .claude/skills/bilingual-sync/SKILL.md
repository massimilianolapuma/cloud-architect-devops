---
name: bilingual-sync
description: Use when producing or updating the Italian version of an English doc in this repository (chapter, ADR or page under website/docs/), or when task i18n:check reports a missing, orphan or stale Italian file.
---

# Bilingual sync (EN → IT)

## Overview

English is canonical. The Italian file lives at the **same relative path** under `website/i18n/it/docusaurus-plugin-content-docs/current/`, is translated from the current English file, then **stamped** with the English file's hash. Any later edit to the English file makes the Italian stale until it is re-translated and re-stamped.

## Hard rules

1. Never edit the English file. If you find an error in it, report it.
2. Stamp a file only after translating it from the English text as it is now. Never stamp to silence a `stale` line. There is deliberately no stamp-all: stamp each file by name.
3. Same file name and extension as English (`.mdx` stays `.mdx`; ADR names stay English, e.g. `adr/0001-docs-as-code-bilingual.md`).
4. Do not translate code, identifiers, file names, paths, URLs, commands or the `UNVERIFIED` marker.
5. Frontmatter values other than `title` are copied from the current English file, including `status` and `last_reviewed` (chapter) or `status` and `date` (ADR). Never invent, update, or keep an older Italian value for them: the English file is the record of the user's decision.

## Paths

| English | Italian |
|---|---|
| `website/docs/<rel>` | `website/i18n/it/docusaurus-plugin-content-docs/current/<rel>` |

Stamp: `node tools/i18n-parity.mjs stamp <rel>` (`<rel>` relative to `website/docs/`, e.g. `00-foundations/docs-as-code.mdx`, `adr/0001-docs-as-code-bilingual.md`).

## What to translate and what to keep

| Translate | Keep exactly |
|---|---|
| prose, headings, table text, list items, link text, image alt text | fenced code blocks, inline code, commands, paths, URLs, link and image targets |
| frontmatter `title` | every other frontmatter key and value (`doc_type`, `status`, `owner`, `owner_handle`, `last_reviewed`, `date`, `deciders`, `slug`, ...) |
| Mermaid node labels | Mermaid node ids and keywords |
| | `import` lines and JSX such as `<FlowExplorer flow={x} />` |

Terms: read `tools/glossary.yaml`. `keep_english: true` → keep the English term; otherwise use the `it` value.

## Required Italian headings (the lint checks the H2s)

| Doc | English | Italian |
|---|---|---|
| chapter H2 | Understand · Decide · Copy · Verification status | Capire · Decidere · Copiare · Stato di verifica |
| chapter H3 | Options · Weighted matrix · Recommendation · When to deviate · Decision record | Opzioni · Matrice pesata · Raccomandazione · Quando derogare · Registro della decisione |
| ADR H2 | Context and Problem Statement · Decision Drivers · Considered Options · Decision Outcome · Pros and Cons of the Options · More Information | Contesto e problema · Fattori decisionali · Opzioni considerate · Decisione · Pro e contro delle opzioni · Ulteriori informazioni |
| ADR H3 | Consequences · Confirmation | Conseguenze · Conferma |

Other wording follows `templates/chapter.it.md` and `templates/adr.it.md` (e.g. "Exercised live locally" → "Provato dal vivo in locale", "Not exercised" → "Non provato", `Chosen option:` → `Opzione scelta:`, `Good, because` → `Positivo, perché`, `Bad, because` → `Negativo, perché`).

A link to an anchor (`#some-heading`) breaks when the heading is translated: point it at the Italian heading's anchor.

## Steps

1. For each English file you were given: read it, the glossary and the Italian template.
2. Write the full Italian file at the mirror path (create folders as needed). Keep the structure one-to-one: same sections, tables, diagrams, code.
3. `grep -n '_Guidance:' <it-file>` must print nothing.
4. `node tools/i18n-parity.mjs stamp <rel>` → prints `stamped <rel>`.
5. Run the gates.

## Done only when

`task i18n:check` prints `i18n parity OK` and `task content:lint` prints `content lint OK`. Report both outputs and the list of files stamped. If i18n:check names a file you were not asked to translate, report it; do not stamp it.

## Red flags: stop

- The Italian `status`, `last_reviewed` or `date` differs from the English file, or you are about to set one yourself (for example `draft` on a re-translation, or today's date). Copy the English value.
