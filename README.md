# cloud-architect-devops

Enterprise architecture guidelines for multi-tenant, cloud-agnostic platforms (Azure, GCP, on-prem Rancher), delivery, database releases with guaranteed rollback and business continuity. Published as a bilingual (English / Italian) Docusaurus site for architects who decide, delivery teams who copy runnable templates, and stakeholders who need to understand.

Everything is tested locally; no cloud resources are needed.

## Run the site

```sh
pnpm install
task site:dev
```

## Verify

```sh
task verify
```

Runs every gate (tool tests, content lint, EN/IT parity, diagrams, flows, agentic chain lint, site build) and stops at the first failure.

Contributor and agent rules are in `CLAUDE.md`; the design is in `docs/superpowers/specs/`.
