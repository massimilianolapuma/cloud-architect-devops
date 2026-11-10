# Local test bed results

Observed on 2026-11-10 with `task testbed:smoke` (script: `smoke.sh`).
Only facts seen in this run are recorded here.

## Environment

- macOS arm64; Podman 6.1.4, machine `podman-machine-default` (libkrun, 9 CPUs,
  7349 MiB RAM, 4 KiB pages, aarch64 guest).
- minikube v1.39.0, kubectl client v1.37.2.
- Cluster: profile `cad`, driver podman (rootless), containerd 2.3.4,
  Kubernetes v1.37.0, `--memory=3g --cpus=2`, CNI Calico (node image
  `quay.io/calico/node:v3.32.2`). Cilium was not needed and was not tried.
- Databases: PostgreSQL 17.11 (aarch64), MongoDB 8.3.13, SQL Server
  `mcr.microsoft.com/mssql/server:2022-latest`.

## Assertions

| # | Assertion | Result |
|---|-----------|--------|
| 1 | `minikube start -p cad` with Calico | PASS (about 1 to 2 minutes; Ready after 54 s to 92 s) |
| 2 | `t-a` -> Service in `t-b` succeeds without policy | PASS (first success after 1 s) |
| 3 | After default-deny ingress in `t-b`, same request fails with curl exit 28 (timeout); after deleting the policy it succeeds again | PASS (exit code 28, then success after policy removal) |
| 4 | `postgres:17` answers `SELECT 1` | PASS |
| 5 | `mongo:8` answers `ping` | PASS |
| 6 | SQL Server 2022 answers `SELECT 1` | FAIL in both modes |
| 7 | Free memory with cluster and three databases | NOT REACHED (see below) |

Conclusion for the test bed: Calico enforces NetworkPolicy on this machine.
The script requires curl exit code 28 under the policy and a successful
request again after the policy is deleted, so the timeout is attributable to
the policy and not to a DNS, kubectl or pod fault.

## SQL Server

- The image has no arm64 variant: `docker image inspect` reports
  `amd64`. So "native" and `--platform linux/amd64` ran the same emulated image.
- Both attempts: the container exits with code 139 right after start
  (`launch_sqlservr.sh: line 28: Segmentation fault (core dumped)`), so
  `sqlcmd` never connected. No substitute was tried; the choice is open.

## Memory (assertion 7 not reached; measured with cluster + PostgreSQL + MongoDB, no SQL Server)

`free -m` in the Podman machine, with the user's own `minikube` profile also
running plus three unrelated containers:

    total 7349  used 5286  free 158  buff/cache 2143  available 2062

`docker stats`: user's `minikube` container 3.713 GiB (limit 6 GiB),
`cad-smoke-postgres` 23.9 MiB, `cad-smoke-mongo` 117.6 MiB. Before starting
this test bed the same machine showed available 2890 MiB with the user's
profile running.

## Findings that shape later phases

- Rule for `task e2e`: on this 7.3 GiB machine, with another minikube profile
  already running, one 3 GiB cluster plus PostgreSQL plus MongoDB fits and
  leaves about 2 GiB available. Run one cluster and at most those two
  databases together; do not plan to run SQL Server alongside until it starts
  at all (see above) and its memory is measured. A SQL Server container
  needs roughly 2 GiB by vendor guidance (not measured here).
- Pod DNS: the host search domain leaks into pod `resolv.conf`. With musl-based
  `curlimages/curl`, relative names such as `web.t-b.svc.cluster.local`
  timed out (resolving) even after minutes, because the upstream SERVFAILed on
  the search-domain expansions. Absolute names (trailing dot, e.g.
  `web.t-b.svc.cluster.local.`) worked immediately. Tests must use absolute
  names or pod/Service IPs.
- minikube is configured rootless (`MINIKUBE_ROOTLESS=true` in its global
  config) but, in the run that failed first, `podman info` on the default
  connection reported rootless=false, so `minikube start` failed with "does
  not seem rootless". The script and `testbed:down` therefore set
  `CONTAINER_CONNECTION=podman-machine-default` for minikube only (the `cad`
  cluster runs in the rootless connection); `docker` containers run in the
  root connection.

## Incident: Podman default connection changed during this task

- Before: `podman system connection list` showed no connection as default
  (both `Default` false). The user's `minikube` container was visible through
  plain `podman ps` and the `docker` CLI (root connection).
- Run during debugging (mistake): `podman system connection default
  podman-machine-default`. Effect: the default became the rootless connection
  and `minikube profile list` reported the user's `minikube` profile as
  errored (its container is in the root connection). The container itself was
  never stopped.
- Attempted to unset the default by editing
  `~/.config/containers/podman-connections.json`; that was denied and not
  done. Then ran `podman system connection default podman-machine-default-root`
  to restore the earlier behavior.
- Now: `podman-machine-default-root` is marked default (`true`); it was unset
  originally. Behavior matches the original (root), but the stored setting is
  not identical to the original unset state. The user has been informed.

- `task testbed:smoke` does not depend on `doctor`: `doctor` currently exits 1
  (unrelated broken `drawio`), which would block it.
