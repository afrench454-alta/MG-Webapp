# Release flow (staging + promote-only production)

Glow Me rule: **production must stay stable during business use.** Agents do not ship straight to live.

## Environments

| Role | Git | URL |
|------|-----|-----|
| **Production (live business app)** | `production` branch | https://mg-webapp-host.vercel.app |
| **Staging (safe to break)** | `main` branch | https://mg-webapp-host-git-main-afrench454-altas-projects.vercel.app |
| **PR previews** | feature branches | Vercel preview URLs per PR |

## Vercel project setting (required once)

In [mg-webapp-host → Settings → Git](https://vercel.com/afrench454-altas-projects/mg-webapp-host/settings/git):

**Production Branch** = `production` (not `main`).

Until that is set, every merge to `main` still updates live production.

## Day-to-day for agents

1. Open PRs against `main`.
2. Merge to `main` only when asked — that updates **staging**, not production (after the setting above).
3. Smoke on staging / PR preview.
4. **Do not** merge to `production`, run `vercel --prod`, or Promote unless Glow Me (or Chief of Staff quoting Glow Me) explicitly says to promote.

## Promote to production (only when Glow Me says so)

Preferred:

1. Open PR: `main` → `production`.
2. After checks are green and Glow Me confirms, merge.
3. Vercel deploys that merge to https://mg-webapp-host.vercel.app.

Alternative: in Vercel, **Promote** a Ready staging/preview deployment to Production.

## Rollback

Use Vercel **Rollback** on the production deployment, or revert the commit on `production`.

## Env vars

Keep `GEMINI_API_KEY` / `GOOGLE_API_KEY` (and other secrets) set for **Production** and **Preview** so staging and new previews do not lose AI features.
