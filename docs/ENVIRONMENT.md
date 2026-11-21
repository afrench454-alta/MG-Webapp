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

## Disposable Supabase integration

Install the locked Node dependencies with `npm ci`. Use a supported Docker or Podman host with `psql` on PATH. The runner accepts the loopback endpoints and public key from the pinned CLI's local status only. Never connect the runner to a hosted project, and keep ports 54321 and 54322 local to the disposable host.

From a fresh isolated checkout and stack:

```sh
npx --no-install supabase start
npx --no-install playwright install chromium
node scripts/check-local-supabase.mjs --browser
npx --no-install supabase stop
```

The first start applies the migrations and seeds the two synthetic tenants. The runner creates a fresh synthetic invoice and ledger entries on every run. Reset or discard that stack after testing. The SQL suites run with psql and roll back their own fixtures. Auth, PostgREST and Storage use the local public key and ordinary signed-in sessions. Omit `--browser` to run just the Auth, HTTP API and SQL checks. The browser pass builds a production-mode app on loopback port 3210 and uses the same seeded identities. It records sanitized CSP event summaries in `test-results/supabase-browser.json`. CI uploads the same report from the `supabase-integration` job.
