---
name: guideline-chapter
description: Use when writing or fixing the English chapter of a guideline topic in this repository (website/docs/<section>/<topic>.md or .mdx), from an approved .work/<topic>/design.md and its research files, or when resolving review findings on a chapter.
---

# Guideline chapter

## Overview

A chapter gives three audiences what they need: **Understand** (stakeholders), **Decide** (architects), **Copy** (delivery teams), plus an honest **Verification status**. Every technical claim comes from the research files; nothing is claimed as tested unless it was run.

## Hard rules

1. **Sourced or marked.** Every technical claim traces to a finding in `.work/<topic>/research-{azure,gcp,onprem}.md` and carries that finding's source as an inline link. A claim with no research finding is either prefixed `UNVERIFIED:` or deleted. Do not add facts from memory.
2. **Verification status lists only what was executed**, each with the exact command, the date and the result. Evidence counts only if it is (a) an offline command you ran in this session (a lint, a test or a build that needs no container, cluster or cloud; never `testbed:*` or `ref:*` tasks, never `podman`, `docker`, `kubectl` or `minikube`), (b) an entry in `reference/<area>/<piece>/RESULTS.md`, or (c) verifier output handed to you. Everything else goes under "Not exercised". Anything needing a cloud account, and anything needing containers or a cluster while the project Podman machine `cad` is not active, is "Not exercised live".
3. **No template leftovers.** Every `_Guidance:` line and every placeholder value from the template is deleted or replaced (see the leftover check below).
4. **English only, EN file only.** Do not create or edit Italian files, diagrams, flows or anything under `reference/` (other agents own them).
5. **A new chapter gets `status: draft` and `last_reviewed` = today. An existing chapter's `status` and `last_reviewed` are never changed by an agent**, in any mode: they record decisions and reviews by the user, who alone moves a chapter to `reviewed` or `approved`. When you edit an existing chapter, leave both lines exactly as they are.

## Inputs and output

| Item | Path |
|---|---|
| Topic slug | `<section>/<topic>`, e.g. `00-foundations/docs-as-code`; work dir `.work/<topic>/` |
| Design | `.work/<topic>/design.md` (outline, options, matrix, recommendation, planned diagrams, planned runnable piece, ADR path) |
| Research | `.work/<topic>/research-azure.md`, `research-gcp.md`, `research-onprem.md` |
| Template | `templates/chapter.en.md` |
| **Output** | `website/docs/<section>/<topic>.mdx` if design.md plans an interactive flow, otherwise `website/docs/<section>/<topic>.md` |

## Steps

1. Read design.md, the three research files and `templates/chapter.en.md`.
2. If the output file already exists, edit it in place and keep its `status` and `last_reviewed` (rule 5). Otherwise copy the template to the output path. Frontmatter of a new chapter: `doc_type: chapter`, real `title`, `owner` as named in design.md (if none: `unassigned`, and say so in your report), `status: draft`, `last_reviewed` = today (`date +%F`).
3. Keep the four H2 headings verbatim: `Understand`, `Decide`, `Copy`, `Verification status`. Add further sections only where useful.
4. **Understand**: problem, why it matters, outcome, in plain language; explain every term a non-engineer would not know. Embed each diagram design.md plans for this view, at its exact path: `![<what the diagram shows>](pathname:///diagrams/<section>/<name>.svg)`. The `pathname://` prefix is mandatory. If design.md plans a flow, add after the frontmatter and before the H1:
   ```mdx
   import FlowExplorer from '@site/src/components/FlowExplorer';
   import myFlow from '@site/src/data/flows/<name>.json';
   ```
   and `<FlowExplorer flow={myFlow} />` where it belongs.
5. **Decide**: every option in design.md (at least two), the weighted matrix (weights sum to 100, scores 1 to 5, each total = sum of weight x score; recompute every total yourself), the recommendation with its two or three deciding reasons, "When to deviate" with concrete conditions, and the decision record linking the real ADR: `[ADR NNNN](../adr/NNNN-kebab-title.md)`. If the ADR mentions this chapter as a code span and its `status` is `proposed`, turn the mention into a link now that the chapter exists; if its status is anything else, do not edit the ADR and report the change instead (skill `adr-author`, rule 1).
6. **Copy**: name the runnable piece as a code span (`reference/<area>/<piece>/`), one sentence on what it does, the command (`task <name>`), then the adoption checklist. Do **not** make it a Markdown link: links from `website/docs/` to files outside it break `task site:build`. If design.md says the runnable piece is `none`, say there is none and why, and keep a checklist.
7. **Verification status**: two bullets, "Exercised live locally" (each item: command, date, result, from the evidence in rule 2; "None yet" if there is none) and "Not exercised" (everything else, including all cloud-only parts).
8. In an `.mdx` file a bare `<` or `{` in prose breaks the build: put it in a code span or write `&lt;`.
9. Run the leftover check and the gate.

## Fix mode (review findings)

Given `.work/<topic>/review.md`: resolve every `blocker` and `major` finding in the chapter (and the ADR, see `adr-author`). Then append to review.md, under `## Author response`, one line per finding id: `R3: fixed — <what changed>` or `R3: rejected — <reason with evidence>`. Do not edit or delete the reviewer's findings. Do not touch `status` or `last_reviewed` (rule 5). Update Verification status if new evidence exists.

## Leftover check (must print nothing)

```bash
grep -nE '_Guidance:|team-or-person|2026-01-01|kebab-title|path/to/template|<section>|<name>|Option [AB]\b|Criterion (one|two)|Alt text describing|Chapter title|Prerequisite or first step|what was run, how, and when|only reasoned about or read from|\| 280 \| 420 \|' website/docs/<section>/<topic>.md*
```

## Done only when

`task content:lint` prints `content lint OK` and the leftover check prints nothing. Report both outputs. If the lint fails on a file you do not own, report it; do not edit that file.

## Red flags: stop and fix

- A sentence states a version, limit, price or behaviour and no research finding supports it.
- "Exercised live" lists something you did not see run, or that came from documentation.
- You are tempted to write "should work" or "tested" for a cloud service.
- The matrix totals were copied, not recomputed.
- You are about to change the `status` or `last_reviewed` line of a chapter that already existed (for example back to `draft`, or today's date after a fix). Leave both as they are.
