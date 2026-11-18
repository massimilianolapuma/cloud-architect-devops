# CLAUDE.md

Rules for every Claude Code session and agent in this repository. They are exact; follow them literally. If any rule below blocks what you were asked to do, stop, do not work around it, and report which rule and why.

## Purpose

Enterprise architecture guidelines (multi-tenant, cloud-agnostic across Azure, GCP and on-prem Rancher; delivery; database releases with guaranteed rollback; business continuity), published as a bilingual (EN/IT) Docusaurus site. Three audiences: architects who decide, delivery teams who copy runnable templates, stakeholders who need to understand.

## Folder map

| Path | Holds |
|---|---|
| `website/docs/` | All guideline content (English, canonical): chapters, ADRs under `adr/`, exception records under `exceptions/`, `intro.mdx`, `compliance/` |
| `website/i18n/it/` | Italian mirror of `website/docs/` (translated and stamped) |
| `website/src/`, `website/static/diagrams/` | Site code, interactive flows (`src/data/flows/*.json`), exported SVGs |
| `diagrams/` | draw.io sources (`<section>/<name>.drawio`), exported to SVG |
| `reference/` | Runnable pieces (manifests, charts, modules, migrations, scripts); `reference/testbed/` is the local test bed |
| `templates/` | `chapter.{en,it}.md`, `adr.{en,it}.md`, `exception.{en,it}.md`: the document contract |
| `tools/` | ESM `.mjs` gate scripts with `node --test` tests |
| `.github/` | The CI workflow that runs the gates (`workflows/verify.yml`) and `CODEOWNERS` |
| `.claude/` | `skills/`, `agents/`, `workflows/` of the agentic chain |
| `docs/superpowers/` | Approved design spec (`specs/`) and plans (`plans/`). The root `docs/` holds nothing else |
| `.work/<topic>/` | Git-ignored working files of a topic: research, `design.md`, `review.md` |

Guideline content lives in `website/docs/`, never in the root `docs/`.

## Hard rules

1. **Local-first.** Everything is tested on the user's Mac. No cloud resources, no cloud credentials, no cloud spend, unless the user explicitly asks for the optional cloud phase.
2. **Podman.** The test bed (minikube profile `cad`, PostgreSQL, MongoDB, SQL Server) runs in a DEDICATED Podman machine named `cad` (provider `applehv`, Rosetta). Podman allows one active machine at a time, so `cad` and the user's default machine never run together.
   - Never start, stop or switch Podman machines. Never change Podman configuration (`podman system connection`, `podman machine init/set/rm/start/stop`, `containers.conf`) without the user's explicit go-ahead at that moment.
   - Before any container or cluster work run `podman machine list` (or `task machine:status` once that task exists). If `cad` is not the running machine, stop and report. Do not use the default machine as a substitute.
   - The machine `cad` and the `machine:status` task are not available yet: treat them as absent.
   - The existing `testbed:*` tasks still target the user's default Podman machine and must not be run by agents until they have been moved to the machine `cad` (a later task does this and will remove this sentence). `ref:*` tasks require `cad` to be the running machine.
3. **Kubernetes.** Never touch kube context `dol-lab-aks`. Never stop, modify or delete minikube profile `minikube`. Always pass `--context cad` / `-p cad` explicitly.
4. **Git.** No `git push` without the user's confirmation. Commit on feature branches, Conventional Commits, `git add` with explicit paths (never `git add -A` or `.`).
5. **Status is the user's.** Only the user changes a document's `status` (ADR to `accepted`, chapter to `reviewed` / `approved`) and a chapter's `last_reviewed` after creation. A new chapter is `draft` with `last_reviewed` = today; a new ADR is `proposed`.
6. **Honesty.** A chapter's "Verification status" lists only what was actually executed, with command, date and result. Anything not run live is stated as not exercised. Never fake, simulate or substitute a result.
7. **Language.** English is canonical. Italian is translated and stamped (`node tools/i18n-parity.mjs stamp <relPath>`). Code, file names, identifiers and commit messages are in English.
8. **Diagrams and links.** Embed diagrams as `![alt](pathname:///diagrams/<section>/<name>.svg)`. Write paths under `reference/` (and anything outside `website/docs/`) as code spans, never as Markdown links: a link out of `website/docs/` breaks the site build.
9. **Tools.** Scripts in `tools/` are ESM `.mjs` with `node --test` tests.

## Document contract

Chapters and ADRs start from `templates/` (`chapter.en.md`, `adr.en.md`, and the `.it.md` counterparts). A chapter has frontmatter (`doc_type`, `title`, `owner`, `owner_handle`, `status`, `last_reviewed`; `owner_handle` is the owner's GitHub handle, quoted: `'@user'` or `'@org/team'`) and the H2 sections `Understand`, `Decide`, `Copy`, `Verification status`. An ADR is a MADR file under `website/docs/adr/`. An exception record (`doc_type: exception`, template `templates/exception.en.md` and `.it.md`) lives only at `website/docs/exceptions/<section>/<chapter>/<id>.md`, where `<section>/<chapter>` is an existing chapter, with every field of the template present (`id` as `exc-NNNN`, `title`, `guideline`, `scope`, `category`, `status`, `requested_by`, `requested_on`, `approved_by`, `approved_on`, `expires` at most 6 months after `approved_on`, `replaces`, `restricted_ref`) and the H2 sections `Reason`, `Risk`, `Compensating control`, `Plan to comply`, `Platform objects`. `task content:lint` enforces this; the templates are the reference. A doc that embeds a flow must be `.mdx` in both languages.

## How a topic is made

1. Workflow `topic-design` (`.claude/workflows/`): research (azure, gcp, onprem) -> design -> adversarial check. Output in `.work/<topic>/` plus a proposed ADR.
2. The user reviews and approves the design. Nothing is built before that.
3. Workflow `topic-build`: chapter, diagrams, runnable piece -> verify -> adversarial review -> fix -> Italian translation -> final verify.

Agents and skills for each step are in `.claude/agents/` and `.claude/skills/`; read the skill before doing that kind of work.

## Verification

- `task verify` runs, in order and stopping at the first failure: `doctor`, `test:tools`, `content:lint`, `codeowners:check`, `i18n:check`, `diagrams:check`, `flows:check`, `agentic:lint`, `site:build`.
- `task verify` must exit 0 before you declare anything finished. Report its real output; never claim a pass you did not see.
- `task site:dev` starts the dev server. `task diagrams:export` regenerates SVGs from `diagrams/*.drawio`.

## Reference

Design: `docs/superpowers/specs/2026-11-10-cloud-architect-devops-design.md` (Italian). Plans: `docs/superpowers/plans/`.
