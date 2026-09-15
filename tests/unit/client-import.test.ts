import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Client } from "../../src/features/console/domain";
import {
  matchExistingClient,
  normalizePhone,
  parseClientImportText,
  planClientImport,
} from "../../src/features/console/data/client-import";
import { clientMutationSchema } from "../../src/features/console/data/client-contract";

const existing: Client[] = [
  {
    id: "live-1",
    name: "Tertius",
    status: "Active",
    phone: "0484719090",
    email: "team@mowglowpropertyservices.com.au",
    preferred: "Phone",
    properties: [{ name: "Anne Ct", address: "4 Anne Ct, Kingaroy", cadence: "Fortnightly" }],
    notes: "",
  },
  {
    id: "live-2",
    name: "Freemans",
    status: "Active",
    phone: "0400856532",
    email: "",
    preferred: "Phone",
    properties: [{ name: "Haly St", address: "2/120 Haly St Kingaroy", cadence: "One-off" }],
    notes: "",
  },
  {
    id: "live-3",
    name: "Leonie Black",
    status: "Active",
    phone: "+61400778874",
    email: "admin@blacksmachineryrepairs.com.au",
    preferred: "Email",
    properties: [],
    notes: "",
  },
];

test("normalizePhone strips country code", () => {
  assert.equal(normalizePhone("+61484719090"), "0484719090");
  assert.equal(normalizePhone("0484 719 090"), "0484719090");
});

test("parseClientImportText rejects junk and oversized arrays", () => {
  assert.equal(parseClientImportText("{").ok, false);
  assert.equal(parseClientImportText("[]").ok, false);
  assert.equal(parseClientImportText(JSON.stringify({ clients: [{ name: "A" }] })).ok, true);
});

test("planClientImport skips live matches and creates new clients", () => {
  const plan = planClientImport(
    [
      {
        name: "Tertius & Clarize",
        status: "Lead",
        phone: "+61484719090",
        email: "",
        preferred: "Phone",
        properties: [],
        notes: "",
      },
      {
        name: "Chelsie APM",
        status: "Lead",
        phone: "0493884659",
        email: "",
        preferred: "Phone",
        properties: [{ name: "APM", address: "99 Youngman St Kingaroy", cadence: "One-off" }],
        notes: "Waste removal",
      },
      {
        name: "Leonie Black",
        phone: "0400778874",
        email: "admin@blacksmachineryrepairs.com.au",
        status: "Active",
        preferred: "Phone",
        properties: [],
        notes: "",
      },
    ],
    existing,
  );

  assert.equal(plan.createCount, 1);
  assert.equal(plan.skipCount, 2);
  assert.equal(plan.rows[1]?.decision, "create");
  assert.equal(plan.rows[0]?.decision, "skip");
});

test("planClientImport skips in-file duplicates and invalid rows", () => {
  const plan = planClientImport(
    [
      {
        name: "Faye",
        status: "Lead",
        phone: "0741622294",
        email: "",
        preferred: "Phone",
        properties: [{ name: "Home", address: "13 Bella Vista St", cadence: "One-off" }],
        notes: "",
      },
      {
        name: "Faye",
        status: "Lead",
        phone: "0741622294",
        email: "",
        preferred: "Phone",
        properties: [],
        notes: "",
      },
      { name: "", phone: "", email: "not-an-email" },
    ],
    [],
  );

  assert.equal(plan.createCount, 1);
  assert.equal(plan.skipCount, 1);
  assert.equal(plan.invalidCount, 1);
});

test("legacy address/frequency rows map onto properties", () => {
  const plan = planClientImport(
    [
      {
        name: "Diane Doak",
        phone: "0411614653",
        email: "",
        address: "28 Earl St Kingaroy",
        frequency: "One-off",
        notes: "Wellways",
      },
    ],
    [],
  );

  assert.equal(plan.createCount, 1);
  const payload = plan.rows[0]?.payload;
  assert.ok(payload);
  assert.equal(payload.properties[0]?.address, "28 Earl St Kingaroy");
  assert.equal(clientMutationSchema.safeParse(payload).success, true);
});

test("matchExistingClient does not treat shared team inbox as identity", () => {
  const payload = clientMutationSchema.parse({
    id: "import-1",
    name: "Brand New Person",
    status: "Lead",
    phone: "0499000111",
    email: "team@mowglowpropertyservices.com.au",
    preferred: "Phone",
    properties: [],
    notes: "",
  });
  assert.equal(matchExistingClient(payload, existing), undefined);
});

test("checked-in clients export is a valid create-only batch against sample live directory", () => {
  const exportPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/clients_export_2026-09-15_new_only.json",
  );
  let text: string;
  try {
    text = readFileSync(exportPath, "utf8");
  } catch {
    text = readFileSync(
      "/workspace/artifacts/clients_export_2026-09-15_new_only.json",
      "utf8",
    );
  }
  const parsed = parseClientImportText(text);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const plan = planClientImport(parsed.records, existing);
  assert.equal(plan.invalidCount, 0);
  assert.equal(plan.createCount, parsed.records.length);
  for (const row of plan.rows) {
    if (row.payload) {
      assert.equal(clientMutationSchema.safeParse(row.payload).success, true);
    }
  }
});
