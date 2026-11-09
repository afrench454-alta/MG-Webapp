# Start and verify demo services

1. Work at the checked-out repository root. Confirm both public Supabase variables are absent/empty for demo; optional AI keys should not be configured.
2. Start `NEXT_PUBLIC_SUPABASE_URL='' NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='' npm run dev -- --hostname 0.0.0.0 --port 3000` using the environment's persistent process facility.
3. Wait for readiness, open the environment-provided reachable preview and verify the dashboard renders with no auth redirect.
4. Exercise a harmless synthetic-data UI action in a supported browser. Do not call setup complete if browser execution is blocked.
5. Keep preview 3000 separate from Playwright's own demo server on 3100. Record reachable preview URL and check results in HANDOFF.

Do not carry over the temporary review-host shim. If startup fails, diagnose the concrete host/config issue and record it; do not change production settings.
