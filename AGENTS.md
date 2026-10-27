<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Preview URL Requirement (Always Active)
- Whenever you make any changes to any repository, you **MUST** start or ensure the local preview server is running (outside the sandbox on Windows so the user's browser can reach it) and include a clickable preview URL (e.g., `http://localhost:3000`) in your response so the user can immediately preview the new changes.
