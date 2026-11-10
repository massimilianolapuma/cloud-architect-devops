#!/usr/bin/env bash
# Local test bed smoke: proves what this machine can run (cluster with an
# enforcing CNI + PostgreSQL, MongoDB, SQL Server). Exits 1 on the first
# failed assertion and names it. Tear down with `task testbed:down`.
set -euo pipefail

# minikube is configured rootless; pin the rootless Podman connection so the
# script does not depend on the machine-wide default connection.
export CONTAINER_CONNECTION="${CONTAINER_CONNECTION:-podman-machine-default}"

PROFILE="cad"
CTX="cad"
CNI="${CAD_CNI:-calico}"
PG_IMAGE="postgres:17"
MONGO_IMAGE="mongo:8"
MSSQL_IMAGE="mcr.microsoft.com/mssql/server:2022-latest"
# Throwaway, local-only password (containers are not published on any port).
DB_PASSWORD="Cad-Smoke-Local-1!"

# Trailing dot = absolute name. The host search domain leaks into pod resolv.conf
# and its upstream SERVFAILs break musl-based curl on relative names (observed).
SVC_URL="web.t-b.svc.cluster.local."

CURRENT="(setup)"
ORIG_CTX="$(kubectl config current-context 2>/dev/null || true)"

restore_context() {
  if [ -n "$ORIG_CTX" ]; then
    kubectl config use-context "$ORIG_CTX" >/dev/null 2>&1 || true
  fi
}

on_exit() {
  local rc=$?
  restore_context
  if [ "$rc" -ne 0 ]; then
    echo "FAILED assertion: ${CURRENT} (exit ${rc})" >&2
  fi
  exit "$rc"
}
trap on_exit EXIT

assert() { CURRENT="$1"; echo "==> ${CURRENT}"; }
pass() { echo "PASS: ${CURRENT}"; }

kc() { kubectl --context "$CTX" "$@"; }

wait_for() { # wait_for <seconds> <description> <command...>
  local limit="$1" desc="$2"; shift 2
  local end=$((SECONDS + limit))
  until "$@" >/dev/null 2>&1; do
    if [ "$SECONDS" -ge "$end" ]; then echo "timeout waiting for ${desc}" >&2; return 1; fi
    sleep 3
  done
}

# --- 1. cluster with an enforcing CNI ---
assert "1. minikube start -p ${PROFILE} (cni=${CNI})"
minikube start -p "$PROFILE" --driver=podman --container-runtime=containerd \
  --cni="$CNI" --memory=3g --cpus=2 --wait=all --wait-timeout=10m
restore_context
kc get nodes
pass

# --- 2. baseline connectivity ---
assert "2. t-a -> t-b service succeeds before any policy"
kc create namespace t-a
kc create namespace t-b
kc -n t-b run web --image=nginx:alpine --port=80
kc -n t-b expose pod web --port=80 --name=web
kc -n t-a run client --image=curlimages/curl --restart=Never --command -- sleep 3600
kc -n t-b wait --for=condition=Ready pod/web --timeout=300s
kc -n t-a wait --for=condition=Ready pod/client --timeout=300s
# Wait for the first success (endpoints/policy programming) and report how long.
start=$SECONDS
wait_for 240 "service reachable from t-a" kc -n t-a exec client -- curl -sS -m 5 -o /dev/null http://${SVC_URL}
echo "first successful request after $((SECONDS - start))s"
kc -n t-a exec client -- curl -sS -m 5 -o /dev/null http://${SVC_URL}
pass

# --- 3. default-deny ingress is enforced ---
assert "3. default-deny ingress in t-b makes the same request time out (curl 28); removing it restores access"
kc apply -f - <<'YAML'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: t-b
spec:
  podSelector: {}
  policyTypes: [Ingress]
YAML
# Require curl exit 28 (operation timed out). Any other failure (kubectl/exec
# error, DNS = 6, refused = 7, missing pod) is not proof of enforcement.
rc=0
for _ in $(seq 1 15); do   # policy programming is async; allow it to converge
  rc=0
  kc -n t-a exec client -- curl -sS -m 5 -o /dev/null "http://${SVC_URL}" || rc=$?
  [ "$rc" -eq 0 ] || break
  sleep 2
done
echo "request with default-deny in place: curl exit code ${rc}"
[ "$rc" -eq 28 ]
# Recovery: removing the policy must restore connectivity, proving the policy
# (and not a lasting fault) caused the timeout.
kc -n t-b delete networkpolicy default-deny-ingress
wait_for 60 "service reachable again after policy removal" kc -n t-a exec client -- curl -sS -m 5 -o /dev/null "http://${SVC_URL}"
echo "request after removing the policy: succeeded"
pass

# --- 4. PostgreSQL ---
assert "4. ${PG_IMAGE} answers SELECT 1"
docker run -d --name cad-smoke-postgres -e POSTGRES_PASSWORD="$DB_PASSWORD" "$PG_IMAGE" >/dev/null
wait_for 120 "postgres" docker exec cad-smoke-postgres pg_isready -U postgres
# pg_isready can pass during init; retry the query itself
wait_for 60 "postgres SELECT 1" docker exec cad-smoke-postgres psql -U postgres -tAc 'SELECT 1'
[ "$(docker exec cad-smoke-postgres psql -U postgres -tAc 'SELECT 1')" = "1" ]
pass

# --- 5. MongoDB ---
assert "5. ${MONGO_IMAGE} answers ping"
docker run -d --name cad-smoke-mongo "$MONGO_IMAGE" >/dev/null
wait_for 120 "mongo ping" docker exec cad-smoke-mongo mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok'
[ "$(docker exec cad-smoke-mongo mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok')" = "1" ]
pass

# --- 6. SQL Server (native first, then linux/amd64) ---
assert "6. ${MSSQL_IMAGE} answers SELECT 1"
mssql_query() {
  docker exec cad-smoke-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa \
    -P "$DB_PASSWORD" -h -1 -W -Q 'SET NOCOUNT ON; SELECT 1'
}
MSSQL_MODE=""
for mode in native linux/amd64; do
  docker rm -f cad-smoke-mssql >/dev/null 2>&1 || true
  platform="$mode"
  [ "$mode" != "native" ] || platform=""
  echo "SQL Server attempt: ${mode}"
  # ${platform:+...} keeps this safe under `set -u` on macOS bash 3.2.
  if docker run -d --name cad-smoke-mssql ${platform:+--platform "$platform"} \
      -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD="$DB_PASSWORD" "$MSSQL_IMAGE" >/dev/null \
    && wait_for 240 "sql server (${mode})" mssql_query \
    && [ "$(mssql_query)" = "1" ]; then
    MSSQL_MODE="$mode"; break
  fi
  echo "SQL Server mode ${mode} failed; last logs:" >&2
  docker logs --tail 15 cad-smoke-mssql >&2 || true
done
[ -n "$MSSQL_MODE" ]
echo "SQL_SERVER_MODE=${MSSQL_MODE}"
pass

# --- 7. memory with everything up ---
assert "7. record free memory of the Podman machine with cluster + 3 databases"
podman machine ssh free -m
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' || true
pass

echo "All 7 assertions passed (cni=${CNI}, sqlserver=${MSSQL_MODE})."
