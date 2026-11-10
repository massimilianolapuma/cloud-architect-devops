---
name: interactive-diagram
description: Use when a guideline chapter in this repository needs a step-by-step interactive diagram (FlowExplorer), when creating or changing a flow JSON under website/src/data/flows/, or when task flows:check fails.
---

# Interactive diagram (FlowExplorer)

## Overview

A flow is a JSON file the site's `FlowExplorer` component renders as nodes, arrows and a stepper. One file carries both English and Italian text. A doc that embeds it must be `.mdx` in both languages.

## Hard rules

1. Every text field has both `en` and `it`, non-empty. Italian follows `tools/glossary.yaml` (`keep_english: true` terms stay in English).
2. The flow's file is `website/src/data/flows/<name>.json`; `id` equals `<name>` (lowercase kebab).
3. Do not edit the component under `website/src/components/FlowExplorer/`. Layout is solved in the JSON.
4. Embed only in an `.mdx` chapter. If the chapter is `.md`, stop and report "chapter must be renamed to .mdx in both languages by its author"; do not rename it yourself.
5. The Italian text inside the JSON is not covered by `i18n:check`: when you change the English text, change the Italian in the same edit.

## Shape (`Flow`)

```json
{
  "id": "release-rollback",
  "title": { "en": "Rolling back a release", "it": "Rollback di un rilascio" },
  "nodes": [
    { "id": "flag", "label": { "en": "Flag off", "it": "Flag spento" }, "x": 0, "y": 0 },
    { "id": "app", "label": { "en": "App rollback", "it": "Rollback app" }, "x": 154, "y": 0 }
  ],
  "edges": [{ "from": "flag", "to": "app" }],
  "steps": [
    {
      "title": { "en": "Turn the flag off", "it": "Spegni il flag" },
      "body": { "en": "The cheapest level: no deploy, no data loss.", "it": "Il livello più economico: nessun deploy, nessuna perdita di dati." },
      "highlight": ["flag"]
    }
  ]
}
```

- `nodes` non-empty, ids unique; `x`, `y` are numbers (pixels). `edges` reference existing node ids. `steps` non-empty; each `highlight` lists existing node ids. Full rules: `website/src/components/FlowExplorer/flow-schema.mjs`.
- Working example: `website/src/data/flows/agentic-chain.json`.

## Layout (labels become unreadable otherwise)

- Nodes are 104px wide. Keep at least 50px between neighbours: columns at `x = 0, 154, 308`.
- The whole flow must fit about 420px of width without shrinking: **at most three columns**.
- Arrange in bands: rows inside a band 70px apart (`y = 0, 70, 140`); leave a larger gap (about 200px) before the next band, as `agentic-chain.json` does (bands at `y = 0..140`, `340`, `450`).
- Labels short (about 24 characters at most); put detail in step bodies.
- Steps tell a story in order; each highlights the nodes it talks about.

## Embedding

In the English `.mdx` chapter, after the frontmatter and before the H1:

```mdx
import FlowExplorer from '@site/src/components/FlowExplorer';
import releaseRollback from '@site/src/data/flows/release-rollback.json';
```

Then `<FlowExplorer flow={releaseRollback} />` on its own line, separated by blank lines, where the chapter discusses it. The import identifier is the camelCase of `<name>`. The Italian `.mdx` gets the same lines unchanged from the translator. If the chapter already has these lines (the author may have added them from design.md), leave them.

## Done only when

`task flows:check` prints `flows OK (<n>)` **and** `task site:build` succeeds (it compiles both locales and fails on broken links and MDX errors). Report both outputs. If `site:build` fails because of a file you do not own, report the error line; do not edit that file.
