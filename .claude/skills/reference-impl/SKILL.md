---
name: reference-impl
description: Use when building or changing a runnable piece under reference/ in this repository (manifests, charts, Terraform modules, migrations, services, scripts) together with the Taskfile task that verifies it, or when such a task fails.
---

# Reference implementation

## Overview

A runnable piece proves what a chapter claims. It lives under `reference/`, is built test-first, is checked by a task in `Taskfile.yml`, and runs **locally at zero cloud cost**. What could not be run is recorded as not run.

**Violating the letter of these rules is violating the spirit of these rules.**

## Hard rules (no exceptions)

**Cloud**
- No cloud resources, no cloud credentials, no `az`/`gcloud` commands that touch an account, no `terraform plan`/`apply`/`destroy` against Azure or GCP. Cloud modules are checked offline only: `terraform fmt -check`, `terraform init -backend=false` + `terraform validate`, `tflint`, `trivy config`, `terraform test` with mocked providers. The optional cloud phase starts only when the user explicitly starts it.

**Kubernetes**
- Every `kubectl` call passes `--context cad`; every `minikube` call passes `-p cad`. Never `kubectl config use-context` to anything but restoring the original context.
- `minikube start -p cad` switches the current context: save `kubectl config current-context` first and restore it at the end, as `reference/testbed/smoke.sh` does.
- Never touch kube context `dol-lab-aks`. Never start, stop, modify or delete the minikube profile `minikube` (the user's).

**Podman** (the project uses a dedicated Podman machine `cad`: applehv, Rosetta; the minikube profile `cad` and all project containers, SQL Server included, live there)
- Never run `podman system connection ...`, `podman machine init|set|rm|start|stop`, never edit `containers.conf`. Never start, stop or switch machines: only one machine can be active, and switching stops the user's own minikube and containers.
- Before any container or cluster work run `task machine:status` if that task exists (exit 0 only when `cad` is the running machine), otherwise `podman machine list`. If `cad` is not the running machine, or does not exist yet, stop that work and report `project machine cad is not active`. Never run project containers in the user's default machine `podman-machine-default` as a substitute.
- Reach machine `cad` only the way the project's Taskfile and `reference/testbed/smoke.sh` do once a later task has moved them to that machine. Never use the connection `podman-machine-default` (or `-root`): it is the user's machine. If no project way to reach `cad` exists yet, the work is `not exercised live`.
- If the container runtime misbehaves, stop and report the exact error. Do not reconfigure anything to work around it.
- Name containers `cad-<piece>-<role>` and remove the ones you started before you finish.

**Honesty**
- Anything that could not run (cloud-only parts; containers or cluster while machine `cad` is inactive; SQL Server when it cannot be started there) is reported as `not exercised live`. Never fake output, never substitute another engine or image, never mark a skipped step as passed.

**Git**
- No `git push`, no branch switching, no amend or rebase. Commit only when your caller tells you to, with explicit paths (`git add <path>...`, never `-A`), Conventional Commits.

## Local traps already found (`reference/testbed/RESULTS.md`)

- Pod DNS: use absolute names with a trailing dot (`web.t-b.svc.cluster.local.`) or IPs; relative names time out.
- The cluster uses Calico, so NetworkPolicy is enforced.
- Memory: one 3 GiB cluster plus at most two databases at a time.

## Steps (TDD)

**REQUIRED SUB-SKILL:** superpowers:test-driven-development.

1. Read design.md "Planned runnable piece". If it says `none`, do nothing and report `runnable piece: none`.
2. Choose the directory `reference/<area>/<piece>/` (areas in use or planned: `testbed`, `control-plane`, `services`, `charts`, `gitops`, `infra`, `pipelines`, `db`, `multirepo-sample`).
3. Write the check first: a script in the piece directory (e.g. `verify.sh`, `set -euo pipefail`) that asserts the behaviour the chapter will claim. Add the task:
   ```yaml
   ref:<piece>:
     desc: <one line: what this proves>
     cmds:
       - bash reference/<area>/<piece>/verify.sh
   ```
   Keep logic in the script: `{{ }}` inside Taskfile commands is go-task's own template syntax and is silently eaten. Check with `task --dry ref:<piece>`.
4. Run `task ref:<piece>`; see it fail for the expected reason.
5. Implement until it passes. Then run it once more from clean state.
6. Write `reference/<area>/<piece>/RESULTS.md`: date, environment, each command run with its observed result, and a "Not exercised live" list. Only facts seen in this run.
7. Write `reference/<area>/<piece>/README.md`: what it is, prerequisites, the command.

## Done only when

`task ref:<piece>` exits 0 and you report its raw output, the task name, the files created and the RESULTS.md content.

If the task cannot run under the rules above (for example machine `cad` is not active), the piece is **not done**: report `not exercised live` with the reason and whatever offline checks did pass, and record the same in RESULTS.md. Never report it as passing.

## Red flags: stop

- "I'll just start the machine / switch the connection, it's quicker."
- "SQL Server won't start, Azure SQL Edge (or PostgreSQL) is close enough."
- "`terraform plan` is read-only, so it's fine against the sandbox."
- A kubectl or minikube command without `--context cad` / `-p cad`.
- Writing RESULTS.md from what the command *should* print.
