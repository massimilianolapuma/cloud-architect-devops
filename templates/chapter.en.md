---
doc_type: chapter
title: Chapter title
owner: team-or-person
status: draft
last_reviewed: 2026-01-01
---

# Chapter title

_Guidance: delete every line starting with "_Guidance:" before publishing. Keep the four H2 headings below verbatim; add further sections where useful._

## Understand

_Guidance: one page for a stakeholder. State the problem, why it matters and the outcome in plain terms, with no jargon left unexplained. Then place one diagram; save its export as `website/static/diagrams/<section>/<name>.svg`._

![Alt text describing what the diagram shows](pathname:///diagrams/<section>/<name>.svg)

## Decide

_Guidance: for the architect. List the options considered, each with one line on what it is._

### Options

_Guidance: one bullet per option considered, at least two._

- **Option A**: one-line description.
- **Option B**: one-line description.

### Weighted matrix

_Guidance: criteria are the forces that matter here; weights sum to 100; scores run 1 to 5. Show the arithmetic in the totals._

| Criterion | Weight | Option A | Option B |
|---|---|---|---|
| Criterion one | 40 | 4 | 3 |
| Criterion two | 60 | 2 | 5 |
| **Total** | 100 | 280 | 420 |

### Recommendation

_Guidance: name the option and the two or three reasons that decided it._

### When to deviate

_Guidance: the conditions under which another option is the better choice, stated concretely._

### Decision record

_Guidance: link the ADR that records this decision._

See [ADR 0001](../adr/0001-kebab-title.md).

## Copy

_Guidance: for the delivery team. Link the runnable piece (path under `reference/` or `templates/`), say what it does in one sentence and give the command to run it. Then the adoption checklist._

Runnable template: [path/to/template](../../reference/path/to/template).

- [ ] Prerequisite or first step
- [ ] Adapt the parameters to your environment
- [ ] Run the verification and record the result

## Verification status

_Guidance: be honest. State what was exercised live on a local machine, with the command and the date, and what was NOT exercised (for example anything needing a real cloud account). Do not claim what was not run._

- **Exercised live locally:** what was run, how, and when.
- **Not exercised:** what was only reasoned about or read from documentation.
