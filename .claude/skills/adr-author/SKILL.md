---
name: adr-author
description: Use when recording an architecture decision for a guideline topic in this repository as a MADR file under website/docs/adr/, or when updating a proposed ADR after design changes or review findings.
---

# ADR author

## Overview

An ADR records one decision in MADR form, starting from `templates/adr.en.md`. Agents write it as `proposed`; **only the user makes it `accepted`.**

## Hard rules

1. New ADRs get `status: proposed`. Never change the `status` of an existing ADR. Before editing an existing ADR, read its `status`: if it is not `proposed`, do not edit the file; report the edit you would make instead. Never write `accepted` or `superseded`: only the user does.
2. Never renumber or rename an existing ADR. Updating means editing that file.
3. Every option, driver and consequence comes from `.work/<topic>/design.md` and the research files; unsupported technical claims are prefixed `UNVERIFIED:` or deleted.
4. Link only to files that exist now. A file that does not exist yet (for example the chapter during `topic-design`) is named as a code span, e.g. `website/docs/00-foundations/docs-as-code.mdx`; a broken link fails `task site:build`. Link to another document under `website/docs/` from the content root, with a leading slash and the file extension, for example `[ADR 0001](/adr/0001-docs-as-code-with-docusaurus.md)` or `[the chapter](/00-foundations/docs-as-code.mdx)`; never with `./` or `../`. While a new English document has no Italian file, a relative link from it to a document that already has one fails the Italian build; a content-root link resolves in both languages.
5. English only; do not create the Italian ADR (the translator does).

## Where and how it is named

- Path: `website/docs/adr/NNNN-kebab-title.md`, directly in `adr/` (the lint rejects subfolders and any other name).
- `NNNN` = next free number: `ls website/docs/adr/` and take the highest four-digit prefix + 1; the first ADR is `0001`. Use the path design.md names if it already reserved one and that number is still free.
- `kebab-title`: lowercase ASCII words joined by `-`, e.g. `0002-gitops-delivery-tool.md`.

## Steps

1. Read design.md (options, drivers, recommendation, when to deviate), the research files and `templates/adr.en.md`.
2. Frontmatter of a new ADR (an existing one keeps its `status`, rule 1): `doc_type: adr`, real `title`, `status: proposed`, `date` = today (`date +%F`), `deciders` as named in design.md (if none: `pending`, and list it as an open question in your report).
3. H1: `# ADR NNNN: <title>`.
4. Keep these H2 headings verbatim (the lint requires the first three): `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Decision Outcome` (with `### Consequences`, `### Confirmation`), `Pros and Cons of the Options` (one `###` per option, renamed to the option), `More Information`.
5. Context: neutral, two to four sentences, no hint of the answer. Considered Options: every option in design.md, chosen one included. Decision Outcome: `Chosen option: "<name>", because <main reason>.` Confirmation: a concrete check (a task, a lint, a review step).
6. More Information: the chapter (link or code span, rule 4), related ADRs, and the conditions to revisit (from "When to deviate").
7. Run the leftover check and the gate.

## Leftover check (must print nothing)

```bash
grep -nE '_Guidance:|names-or-roles|2026-01-01|NNNN|Short title of the decision|Option [ABC]\b|Driver (one|two)|positive consequence|negative consequence|Good, because argument|Bad, because argument' website/docs/adr/<NNNN-kebab-title>.md
```

## Done only when

`task content:lint` prints `content lint OK` and the leftover check prints nothing. Report both outputs and the ADR path.

## Red flags: stop

- You are about to type `status: accepted` because the design "is approved". Approval of a design is not acceptance of the ADR.
- You are editing an ADR whose `status` is `accepted` or `superseded`, or you are about to change any ADR's `status` line. Stop and report the edit instead.
- The number you picked already exists, or you are reusing a number from another branch of thought.
- An option in the chapter's matrix is missing from Considered Options, or the chosen option differs from the chapter's recommendation.
