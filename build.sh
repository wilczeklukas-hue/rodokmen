#!/bin/bash
# validate -> build index.html
set -euo pipefail
cd "$(dirname "$0")"
node validate.js
node build.js
