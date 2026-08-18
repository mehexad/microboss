#!/bin/bash
# MICROBOSS - double-click launcher (macOS)
cd "$(dirname "$0")"
open http://localhost:3000
export PATH="$PWD/.node/bin:$PATH"
node server.js
echo ""
echo "MICROBOSS closed. You can close this window."
