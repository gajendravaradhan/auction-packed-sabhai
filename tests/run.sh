#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --test autosync-ui-state.test.mjs source-sync.test.mjs playoff-resolver.test.mjs series-match-resolver.test.mjs espn-slug-resolver.test.mjs backup-merge.test.mjs
