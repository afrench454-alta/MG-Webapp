#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root, with Node 24 LTS selected by the environment.
# Demo dependencies only. Does not modify a database or deploy anything.
node --version
npm --version
npm ci
npx playwright install chromium
# Host OS browser dependencies may need the environment's supported setup.
