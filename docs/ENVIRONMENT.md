# Environment contract

## Demo

Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY absent/empty. AI keys absent. Synthetic data. Port 3000 interactive preview, 3100 checked-in Playwright server. If a public variable is inherited from a shared environment, clear both explicitly. Never fake a live configuration by supplying one placeholder.

## Staging

Both public Supabase variables point to an isolated test project, NEXT_PUBLIC_APP_URL is the exact trusted test origin. Seed two synthetic tenants and owner/co-owner/technician accounts. Test auth redirects and RLS. Hosted migration target must be explicitly identified; never reuse production by convenience. Store test login secrets using environment secret controls.

## Production

Existing Vercel/Supabase remain in place. Deployment commit, configured runtime, migrations, backup/restore readiness and environment variables were not inspected. Use a separate release task to verify them. Production credentials should not be inherited by preview builds. No service-role key in normal application runtime.

## Optional provider features

GEMINI_API_KEY or GOOGLE_API_KEY: server-side estimator. XAI_API_KEY: optional provider fallback. OPENROUTER_API_KEY and optional OPENROUTER_MODEL: Joseph. No provider required for core invoice development. Check current code/provider docs before enabling model identifiers. Use test/synthetic content and provider-side budgets. AI failures must leave manual workflows usable.

## Tool configuration

Use current installed CLIs and --help; no global unpinned Supabase install. No fabricated .mcp.json or cloud config file is required for this setup. Connect apps through supported ChatGPT/Codex interfaces and scope them to the task/test project. The Codex environment's network policy, variables, access and startup setup are configured in its actual UI; repository scripts do not automatically change those settings.
