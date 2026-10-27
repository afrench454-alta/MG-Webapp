# Security and Reliability Hardening (October 2026)

Targeted changes only. No broad refactor.

## Recurring job authorisation

New migration `202610130001_harden_spawn_next_recurring_job.sql` replaces `spawn_next_recurring_job`.

Before any insert:
- Resolves the job.
- Requires `is_business_member(job.business_id)`.
- Requires `can_manage_business(job.business_id)` (owner / co-owner).
- Raises `42501` (insufficient_privilege) otherwise.

Unauthenticated calls fail the membership check. Cross-tenant calls are rejected. Authorised calls succeed as before.

Grants remain `authenticated` only. Function is `SECURITY DEFINER` with fixed `search_path`.

## Dashboard load errors

`src/app/page.tsx` now distinguishes failed data loads from empty datasets. A non-technical banner is shown via `dataLoadError` on `ConsoleApp` when any slice fails. Sensitive error details are not exposed.

## Invitation redirects

`trustedOrigin` (src/lib/trusted-origin.ts) prefers `NEXT_PUBLIC_APP_URL`. Falls back only to local development hosts. Arbitrary `X-Forwarded-Host` is no longer trusted in non-local environments.

## Tests and CI

- Unit tests for origin construction.
- Migration verification script now asserts the authorisation checks, search_path, and grants for the recurring-job function. Failure of these checks fails the build.
- GitHub Actions workflow runs lint, typecheck, unit tests, migration checks, production build, and Playwright smoke tests.

## Remaining

Full authenticated integration tests against a live or local Supabase instance are recommended for the three recurring-job scenarios (authorised, cross-tenant, unauthenticated). Configure a test project or `supabase start` and add them to CI when credentials are available. The static checks already prevent accidental removal of the authorisation boundary.
