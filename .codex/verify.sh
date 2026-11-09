#!/usr/bin/env bash
set -euo pipefail
# Run against demo/test configuration, from repository root.
npm run check
npm run build
npx playwright test
# Dependency vulnerability review is separate when registry access is available:
# npm audit --audit-level=moderate
# Add DB integration / accessibility commands after those suites exist.
