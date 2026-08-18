#!/usr/bin/env bash
# MICROBOSS launcher — runs the app with the bundled local Node.js
cd "$(dirname "$0")"
export PATH="$PWD/.node/bin:$PATH"
exec node server.js "$@"
