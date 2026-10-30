#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
image="${1:-m4k:smoke}"
docker build --tag "$image" .
container=$(docker run --detach --mount "type=bind,source=$PWD/fixtures,target=/fixtures,readonly" "$image")
trap 'docker logs "$container"; docker rm --force "$container" >/dev/null' EXIT
docker exec --interactive "$container" bun run - < scripts/container-smoke.ts
