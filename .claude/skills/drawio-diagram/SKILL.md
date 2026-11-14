---
name: drawio-diagram
description: Use when a guideline chapter in this repository needs an architecture diagram, when creating or changing a .drawio file under diagrams/, or when task diagrams:check reports a missing, stale, multipage or orphan diagram.
---

# draw.io diagram

## Overview

Diagrams are mxGraph XML sources in git, exported to SVG by the repo's pipeline. You write the XML; the pipeline makes the SVG. One diagram per file, labels in English (the same SVG serves both languages).

## Hard rules

1. Exactly one `<diagram>` element per `.drawio` file. A multi-page file fails `diagrams:check`.
2. Labels in English only. Translate nothing inside the diagram; the Italian chapter translates the alt text.
3. Never write or edit an SVG under `website/static/diagrams/` or `diagrams/manifest.json` by hand. Only `task diagrams:export` writes them.
4. If the export fails (the `drawio` CLI errors or times out), stop and report the error output. Do not fake an SVG and do not copy another one.
5. Touch only the diagrams you were asked for. Do not delete or rename other sources.

## Paths

| Item | Path |
|---|---|
| Source | `diagrams/<section>/<name>.drawio` (`<section>` = the chapter's section, e.g. `00-foundations`; `<name>` lowercase kebab) |
| Export (generated) | `website/static/diagrams/<section>/<name>.svg`, light theme, editable (embeds the source) |
| Manifest (generated) | `diagrams/manifest.json` |
| Embed in a doc | `![<what the diagram shows>](pathname:///diagrams/<section>/<name>.svg)`; the `pathname://` prefix is mandatory |
| Working example | `diagrams/00-foundations/repo-map.drawio` |

Take the names from design.md's "Planned diagrams" when it lists them; the chapter author embeds those exact paths.

## XML shape

Copy the structure of `repo-map.drawio`:

```xml
<mxfile host="drawio"><diagram id="<name>" name="<Readable name>"><mxGraphModel dx="1000" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="920" pageHeight="480" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="api" value="Tenant API" style="rounded=1;whiteSpace=wrap;html=1;fontSize=18;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1a1a1a;" vertex="1" parent="1"><mxGeometry x="40" y="80" width="200" height="60" as="geometry"/></mxCell>
<mxCell id="db" value="PostgreSQL" style="rounded=1;whiteSpace=wrap;html=1;fontSize=18;fillColor=#d5e8d4;strokeColor=#82b366;fontColor=#1a1a1a;" vertex="1" parent="1"><mxGeometry x="340" y="80" width="200" height="60" as="geometry"/></mxCell>
<mxCell id="e1" style="endArrow=classic;html=1;strokeColor=#333333;strokeWidth=2;" edge="1" parent="1" source="api" target="db"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>
```

- Cell ids unique within the file; `0` and `1` are the required root cells; every shape has `parent="1"`.
- Shapes: `vertex="1"` + `<mxGeometry x y width height as="geometry"/>`. Arrows: `edge="1" source="<id>" target="<id>"` + `<mxGeometry relative="1" as="geometry"/>`.
- Escape XML in `value`: `&amp;` `&lt;` `&gt;` `&quot;`. A line break inside an `html=1` label is `&lt;br&gt;`.
- Legibility (export is light theme on a white card in both site themes): always set `fontColor=#1a1a1a`, `fontSize` 14 or more, shapes at least 160 wide, at least 40px between shapes, flow left to right or top to bottom, at most about 12 shapes; split a bigger picture into two diagrams.
- Set `pageWidth`/`pageHeight` to roughly cover the drawing.

## Steps

1. Write the `.drawio` file.
2. `xmllint --noout diagrams/<section>/<name>.drawio` (no output = well-formed).
3. `task diagrams:export` (prints `exported <section>/<name>.drawio`).
4. `task diagrams:check`.
5. If you were asked to embed it, insert only the embed line into the English chapter (see your agent definition for what else you may not change).

## Done only when

`task diagrams:check` prints `diagrams OK`. Report its output and the paths of the source, the SVG and the manifest (all three must be committed together).
