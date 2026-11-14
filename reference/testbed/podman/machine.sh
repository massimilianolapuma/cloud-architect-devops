#!/usr/bin/env bash
# Dedicated Podman machine for the project test bed.
#   machine.sh status  read-only; exit 0 only when machine "cad" is the running one
#   machine.sh init    create "cad" (applehv + Rosetta) if missing; never starts,
#                      stops, removes or switches any machine
# The user swaps machines by hand; nothing here does it.
set -euo pipefail

MACHINE="cad"
CPUS=6
MEMORY_MIB=16384
DISK_GIB=60
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROSETTA_CONF="${HERE}/containers.rosetta.conf"

# Prints "<name> <running>" per machine; a trailing "*" marks the default one.
list_machines() {
  podman machine list --format '{{.Name}} {{.Running}}' | sed 's/\*//'
}

cmd_status() {
  local lines running
  lines="$(list_machines)"
  if ! printf '%s\n' "$lines" | awk -v m="$MACHINE" '$1 == m { f = 1 } END { exit !f }'; then
    echo "project machine \"${MACHINE}\" is not active"
    echo "machine \"${MACHINE}\" does not exist (run: task machine:init)"
    return 1
  fi
  running="$(printf '%s\n' "$lines" | awk '$2 == "true" { print $1 }')"
  if [ "$running" = "$MACHINE" ]; then
    echo "project machine \"${MACHINE}\" is active"
    return 0
  fi
  echo "project machine \"${MACHINE}\" is not active"
  if [ -z "$running" ]; then
    echo "no Podman machine is running"
  else
    echo "running machine: $(printf '%s' "$running" | tr '\n' ' ')"
  fi
  return 1
}

cmd_init() {
  if list_machines | awk -v m="$MACHINE" '$1 == m { f = 1 } END { exit !f }'; then
    echo "machine \"${MACHINE}\" already exists; nothing changed"
    return 0
  fi
  [ -f "$ROSETTA_CONF" ] || { echo "missing ${ROSETTA_CONF}" >&2; return 1; }
  CONTAINERS_CONF_OVERRIDE="$ROSETTA_CONF" podman machine init "$MACHINE" \
    --provider applehv --cpus "$CPUS" --memory "$MEMORY_MIB" --disk-size "$DISK_GIB"
  if [ "$(podman machine inspect "$MACHINE" --format '{{.Rosetta}}')" != "true" ]; then
    echo "machine \"${MACHINE}\" was created WITHOUT Rosetta; remove it and investigate" >&2
    return 1
  fi
  echo "machine \"${MACHINE}\" created (applehv, Rosetta, ${CPUS} CPUs, ${MEMORY_MIB} MiB, ${DISK_GIB} GB), not started."
  echo "Stop your current machine and run: podman machine start ${MACHINE}"
}

case "${1:-}" in
  status) cmd_status ;;
  init) cmd_init ;;
  *) echo "usage: machine.sh status|init" >&2; exit 2 ;;
esac
