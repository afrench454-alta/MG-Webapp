import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationDirectory = resolve("supabase", "migrations");
const initial = readFileSync(
  resolve(migrationDirectory, "202608050001_initial_fieldcentral_schema.sql"),
  "utf8",
);
const clientSlice = readFileSync(
  resolve(
    migrationDirectory,
    "202608050002_business_bootstrap_and_client_rpcs.sql",
  ),
  "utf8",
);

function requirePattern(source, pattern, description) {
  if (!pattern.test(source)) {
    throw new Error(`Migration check failed: ${description}`);
  }
}

const tableNames = [
  ...initial.matchAll(/create table public\.(\w+)\s*\(/g),
].map((match) => match[1]);
const rlsTables = [
  ...initial.matchAll(/alter table public\.(\w+) enable row level security;/g),
].map((match) => match[1]);

const missingRls = tableNames.filter((table) => !rlsTables.includes(table));
if (tableNames.length !== 23 || missingRls.length > 0) {
  throw new Error(
    `Migration check failed: expected RLS on all 23 tables; missing ${missingRls.join(", ") || "none"}.`,
  );
}

requirePattern(
  initial,
  /grant execute on function public\.get_public_questionnaire\(text\) to anon, authenticated;/,
  "public questionnaire read must be the intentional anonymous RPC",
);
requirePattern(
  initial,
  /grant execute on function public\.submit_questionnaire_response\(text, jsonb, text, text, text\)[\s\S]*?to anon, authenticated;/,
  "public questionnaire submission must be the intentional anonymous RPC",
);
requirePattern(
  clientSlice,
  /add column lifecycle_status public\.client_lifecycle_status/,
  "client lifecycle must be stored explicitly",
);
requirePattern(
  clientSlice,
  /add column preferred_contact public\.preferred_contact_method/,
  "preferred contact must be stored explicitly",
);
requirePattern(
  clientSlice,
  /add column service_cadence text/,
  "service cadence must be stored explicitly",
);
requirePattern(
  clientSlice,
  /add column archived_at timestamptz/,
  "clients must support recoverable archive",
);
requirePattern(
  clientSlice,
  /revoke delete on table public\.clients from authenticated;/,
  "authenticated API users must not hard-delete clients",
);

for (const [name, functionName, signature] of [
  ["business bootstrap", "bootstrap_current_user_business", "bootstrap_current_user_business\\(text\\)"],
  ["atomic client save", "save_client_with_details", "save_client_with_details\\(jsonb, uuid\\)"],
  ["client archive", "archive_client", "archive_client\\(uuid\\)"],
]) {
  requirePattern(
    clientSlice,
    new RegExp(`create function public\\.${functionName}\\([\\s\\S]*?\\)\\s*returns[\\s\\S]*?security definer[\\s\\S]*?set search_path = public, pg_temp`),
    `${name} must use a fixed-search-path security definer`,
  );
  requirePattern(
    clientSlice,
    new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated;`),
    `${name} must revoke default execution`,
  );
  requirePattern(
    clientSlice,
    new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to authenticated;`),
    `${name} must be authenticated-only`,
  );
}

if (/grant execute on function public\.(?:bootstrap_current_user_business|save_client_with_details|archive_client)[\s\S]*?to anon/.test(clientSlice)) {
  throw new Error("Migration check failed: a private business/client RPC was granted to anon.");
}

console.log(
  `Migration checks passed: ${tableNames.length}/${tableNames.length} RLS tables and authenticated-only business/client RPCs.`,
);
