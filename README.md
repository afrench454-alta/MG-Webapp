# FieldCentral Pro Console

Production web application for FieldCentral's field-service operations workflow.
The verified console can run as a seeded demo or as an authenticated Supabase
application without maintaining separate UI implementations.

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

## Demo and live modes

- With both public Supabase variables absent, `/` renders the complete seeded
  demo. This is the visual and interaction reference used for local design QA.
- With both variables present, Proxy refreshes the Supabase session, unauthenticated
  users are sent to `/sign-in`, and `/` loads tenant-scoped live clients.
- Partial or malformed configuration fails loudly. Never supply only one public
  Supabase variable.

Copy `.env.example` to `.env.local` and replace the placeholders:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
FIELDCENTRAL_DEFAULT_BUSINESS_NAME=My Field Service Business
```

Do not add a service-role key to this web application. Authenticated database
access is intentionally constrained by RLS and authenticated-only RPCs.

Apply both migrations in `supabase/migrations/` before enabling live mode. The
first authenticated user without a membership receives one owner business and
its defaults atomically. Existing members always resolve to their database role.

The first live repository slice covers clients, their primary contact, and
service properties. Saves are atomic; removal is a recoverable archive that
preserves job, quote, invoice, and address history.

## Quality checks

```bash
npm run check
npm run build
npm audit --audit-level=moderate
```

`npm run check` runs ESLint, the TypeScript compiler, and durable migration
security/invariant checks without emitting application files.

## Portable project export

Create a clean, portable ZIP of the application with:

```bash
npm run export:project
```

The command writes a timestamped archive and SHA-256 checksum to `exports/`.
It includes the application source, Supabase migrations, lockfile, documentation,
and `.env.example`, while excluding dependencies, build output, Git history,
browser QA captures, logs, generated caches, and every real `.env*` file.

To restore an export on another machine, unzip it, run `npm ci`, copy
`.env.example` to `.env.local` only when live Supabase mode is needed, and run
`npm run check && npm run build` before deployment.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Lucide React icons
- Zod validation
- Supabase Auth, Postgres, and RLS
