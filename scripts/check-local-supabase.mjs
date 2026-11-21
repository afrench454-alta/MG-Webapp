import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const tenant = "ce000000-0000-4000-8000-000000000001";
const password = "MowGlowLocalTest123!";
const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };

function localUrl(value, protocol, port) {
  assert.equal(typeof value, "string", "Expected a local CLI endpoint");
  const url = new URL(value);
  assert.ok(
    url.protocol === protocol &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === port,
    "Integration checks require the disposable loopback stack from supabase/config.toml",
  );
  return url;
}

function value(result, label) {
  if (result.error) {
    throw new Error(`${label} failed (${result.error.code ?? result.error.statusCode ?? result.status ?? "unknown"})`);
  }
  return result.data;
}

function databaseDenied(result, codes, label) {
  assert.ok(result.error, `${label} should be denied`);
  assert.ok(codes.includes(result.error.code), `${label} failed for an unexpected reason (${result.error.code})`);
}

function storageDenied(result, allowedStatuses, label) {
  assert.ok(result.error, `${label} should be denied`);
  const status = Number(result.error.statusCode);
  assert.ok(allowedStatuses.includes(status), `${label} failed for an unexpected reason (${status})`);
}

async function run() {
  const status = spawnSync(process.execPath, [cli, "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(status.status, 0, "Start the disposable local Supabase stack before running this check");
  const { API_URL, DB_URL, PUBLISHABLE_KEY, ANON_KEY } = JSON.parse(status.stdout);
  const endpoint = localUrl(API_URL, "http:", "54321").origin;
  const database = localUrl(DB_URL, "postgresql:", "54322");
  const publicKey = PUBLISHABLE_KEY || ANON_KEY;
  assert.ok(publicKey, "Local Supabase status did not report a public API key");
  const guest = createClient(endpoint, publicKey, { auth });

  const actors = await Promise.all(
    ["tenant-a-owner", "tenant-a-coowner", "tenant-a-tech", "tenant-b-owner"].map(async (role) => {
      const client = createClient(endpoint, publicKey, { auth });
      const session = value(
        await client.auth.signInWithPassword({ email: `${role}@example.test`, password }),
        `Seeded sign-in for ${role}`,
      );
      assert.ok(session.session?.access_token, `Missing Auth session for ${role}`);
      return client;
    }),
  );
  const [owner, coowner, technician, otherOwner] = actors;
  assert.equal(value(await owner.rpc("current_business_id"), "Owner membership"), tenant);
  assert.equal(value(await coowner.rpc("current_business_role"), "Co-owner membership"), "co_owner");
  assert.equal(value(await technician.rpc("current_business_role"), "Technician membership"), "technician");
  assert.equal(value(await otherOwner.rpc("current_business_id"), "Other owner membership"),
    "ce000000-0000-4000-8000-000000000002");

  for (const suite of ["invoice-integrity", "workflow-operations", "joseph-confirmation"]) {
    const result = spawnSync("psql", [
      "--no-psqlrc", "--no-password", "--set", "ON_ERROR_STOP=1",
      "--host", database.hostname, "--port", database.port,
      "--username", decodeURIComponent(database.username),
      "--dbname", database.pathname.slice(1), "--file", `tests/sql/${suite}.sql`,
    ], {
      cwd: root,
      env: { ...process.env, PGPASSWORD: decodeURIComponent(database.password) },
      stdio: "inherit",
      timeout: 120_000,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${suite} SQL suite failed`);
  }

  // Create a new synthetic invoice for this run using the operator's public client.
  const clientId = randomUUID();
  value(await owner.from("clients").insert({
    id: clientId, business_id: tenant, display_name: "Local integration client",
  }), "Create synthetic client");
  const draft = {
    clientId, idempotencyKey: randomUUID(),
    issueDate: "2026-11-18", dueDate: "2026-12-20", scope: "Synthetic garden service",
    notes: "", items: [{ description: "Garden service", quantity: 1.25, unitLabel: "hours", rate: 160 }],
  };
  // PostgREST may mask an unavailable function for the anonymous role. The owner
  // exercises the exact same name and argument below to confirm it exists.
  databaseDenied(await guest.rpc("save_invoice_draft", { draft }), ["42501", "PGRST202"], "Anonymous invoice RPC");
  databaseDenied(await technician.rpc("save_invoice_draft", { draft }), ["42501"], "Technician invoice RPC");
  const crossTenantDraft = await otherOwner.rpc("save_invoice_draft", { draft });
  databaseDenied(crossTenantDraft, ["P0001"], "Cross-tenant invoice RPC");
  assert.equal(crossTenantDraft.error.message, "Choose a customer in this business.");
  const invoiceId = value(await owner.rpc("save_invoice_draft", { draft }), "Owner creates invoice");
  assert.equal(value(await owner.rpc("save_invoice_draft", { draft }), "Owner replays draft"), invoiceId);

  const invoices = (actor) => actor.from("invoices");
  const ownerRead = value(await invoices(owner).select("issue_date,due_date,scope_of_work,total")
    .eq("id", invoiceId).single(), "Owner reloads invoice");
  assert.deepEqual(ownerRead, {
    issue_date: "2026-11-18", due_date: "2026-12-20",
    scope_of_work: "Synthetic garden service", total: 200,
  });
  const line = value(await owner.from("invoice_line_items").select("quantity,unit_label,unit_price")
    .eq("invoice_id", invoiceId).single(), "Owner reloads invoice line");
  assert.deepEqual(line, { quantity: 1.25, unit_label: "hours", unit_price: 160 });
  assert.deepEqual(value(await invoices(otherOwner).select("id").eq("id", invoiceId), "Cross-tenant invoice filter"), []);
  databaseDenied(await invoices(guest).update({ title: "Permission check" }).eq("id", invoiceId), ["42501"], "Anonymous table write");
  databaseDenied(await invoices(technician).update({ title: "Permission check" }).eq("id", invoiceId), ["42501"], "Technician table write");
  databaseDenied(await invoices(otherOwner).update({ title: "Permission check" }).eq("id", invoiceId), ["42501"], "Cross-tenant table write");
  value(await coowner.rpc("transition_invoice", {
    target_invoice: invoiceId, action: "issue", expected_version: 1,
  }), "Issue invoice");

  const payment = {
    invoiceId, idempotencyKey: randomUUID(), kind: "receipt", amount: 75, paidOn: "2026-11-19", method: "cash",
  };
  const record = (details) => owner.rpc("record_invoice_payment", { payment: details });
  const receipts = await Promise.all([record(payment), record(payment)]);
  assert.equal(value(receipts[0], "Record partial receipt"), value(receipts[1], "Replay partial receipt"));
  const startingBalance = value(await invoices(owner).select("amount_paid,balance_due").eq("id", invoiceId).single(), "Read partial balance");
  assert.deepEqual(startingBalance, { amount_paid: 75, balance_due: 125 });
  const remainder = () => record({ ...payment, amount: 125, idempotencyKey: randomUUID() });
  const attempts = await Promise.all([remainder(), remainder()]);
  assert.equal(attempts.filter((attempt) => !attempt.error).length, 1);
  assert.match(attempts.find((attempt) => attempt.error).error.message, /exceeds the outstanding balance/i);
  const balance = value(await invoices(owner).select("amount_paid,balance_due").eq("id", invoiceId).single(), "Read paid balance");
  assert.deepEqual(balance, { amount_paid: 200, balance_due: 0 });
  const ledger = value(await owner.from("payments").select("id").eq("invoice_id", invoiceId), "Read payments");
  assert.equal(ledger.length, 2);

  const bucket = (actor) => actor.storage.from("job-attachments");
  const object = `${tenant}/${randomUUID()}/policy-check.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2KsAAAAASUVORK5CYII=", "base64");
  const upload = (actor, path) => bucket(actor).upload(path, png, { contentType: "image/png" });
  value(await upload(owner, object), "Owner uploads tenant attachment");
  try {
    const attachment = value(await bucket(technician).download(object), "Tenant technician downloads attachment");
    assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), png);
    storageDenied(await bucket(guest).download(object), [401, 403, 404], "Anonymous attachment read");
    storageDenied(await bucket(otherOwner).download(object), [403, 404], "Cross-tenant attachment read");
    storageDenied(await upload(otherOwner, object.replace("policy-check", "other-owner")), [403], "Cross-tenant attachment write");
    storageDenied(await upload(technician, object.replace("policy-check", "unassigned-tech")), [403], "Unassigned technician attachment write");
  } finally {
    value(await bucket(owner).remove([object]), "Remove synthetic attachment");
  }
  console.log("PASS Supabase Auth, PostgREST financial permissions and payment persistence, Storage policies, and SQL suites");
}

await run();
