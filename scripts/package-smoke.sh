#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/packs" "$scratch/consumer" "$scratch/work"
for package in common core client; do
  (cd "$root/packages/$package" && bun pm pack --destination "$scratch/packs" --quiet)
done
common=("$scratch"/packs/m4k-common-*.tgz)
# Resolve internal dependencies to this pack even when its version is not published yet.
bun -e 'console.log(JSON.stringify({private:true,type:"module",overrides:{"@m4k/common":`file:${Bun.argv[1]}`}}))' "${common[0]}" > "$scratch/consumer/package.json"
# Copy the runner too: executing it from the repository would resolve workspace dependencies.
cp "$root/scripts/package-smoke.ts" "$scratch/consumer/smoke.ts"
(
  cd "$scratch/consumer"
  bun add --production --ignore-scripts "$scratch"/packs/*.tgz
  env -u NODE_PATH -u FFMPEG_PATH M4K_TMP_DIR="$scratch/work" bun run smoke.ts "$root/fixtures"
)
