import test from "node:test";
import assert from "node:assert/strict";

import {
  invoicePrefillJobs,
  quoteableRequests,
  rankedClients,
  schedulableRequests,
  scopeLinesFromText,
  scopeTextFromInvoice,
} from "../../src/features/console/data/form-options";
import type { Client, Invoice, Job, JobRequest } from "../../src/features/console/domain";

const CLIENT_A = "11111111-1111-4111-8111-111111111111";
const CLIENT_B = "22222222-2222-4222-8222-222222222222";
const JOB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function client(overrides: Partial<Client>): Client {
  return {
    id: CLIENT_A,
    name: "Active Yard",
    status: "Active",
    phone: "0400 000 000",
    email: "a@example.com",
    preferred: "Phone",
    properties: [],
    notes: "",
    ...overrides,
  };
}

function job(overrides: Partial<Job>): Job {
  return {
    id: JOB_A,
    displayName: "Job",
    clientId: CLIENT_A,
    client: "Active Yard",
    property: "Home",
    address: "1 Test St",
    category: "Mowing",
    scope: "Mow lawn",
    date: "26 Sep 2026",
    time: "9:00 am",
    dateKey: "2026-09-26T09:00",
    status: "completed",
    notes: "",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
    ...overrides,
  };
}

function request(overrides: Partial<JobRequest>): JobRequest {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    client: "Active Yard",
    address: "1 Test St",
    category: "Mowing",
    scope: "Mow lawn",
    status: "New",
    created: "20 Sep 2026",
    ...overrides,
  };
}

test("rankedClients puts Active ahead of Lead and Inactive", () => {
  const ranked = rankedClients([
    client({ id: "i", name: "Zed", status: "Inactive" }),
    client({ id: "l", name: "Ann", status: "Lead" }),
    client({ id: "a", name: "Bob", status: "Active" }),
  ]);
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["a", "l", "i"],
  );
});

test("invoicePrefillJobs keeps the selected job, hides cancelled and already invoiced, and filters to the client", () => {
  const jobs = [
    job({ id: JOB_A, status: "completed", dateKey: "2026-09-01T09:00" }),
    job({ id: JOB_B, status: "cancelled", dateKey: "2026-09-02T09:00" }),
    job({
      id: JOB_C,
      clientId: CLIENT_B,
      client: "Other",
      status: "scheduled",
      dateKey: "2026-09-03T09:00",
    }),
  ];
  const invoices: Invoice[] = [
    {
      id: "inv-1",
      client: "Active Yard",
      address: "1 Test St",
      issued: "01 Sep 2026",
      due: "08 Sep 2026",
      documentStatus: "Issued",
      paymentStatus: "Unpaid",
      notes: "",
      items: [],
      jobId: JOB_A,
    },
  ];

  const forClient = invoicePrefillJobs({
    jobs,
    invoices,
    client: client({ id: CLIENT_A }),
  });
  assert.deepEqual(
    forClient.map((item) => item.id),
    [],
  );

  const keepingSelected = invoicePrefillJobs({
    jobs,
    invoices,
    client: client({ id: CLIENT_A }),
    selectedJobId: JOB_A,
  });
  assert.deepEqual(
    keepingSelected.map((item) => item.id),
    [JOB_A],
  );
});

test("quoteableRequests hides scheduled, closed, and already quoted work", () => {
  const open = request({ id: "open", status: "New" });
  const scheduled = request({ id: "sched", status: "Scheduled" });
  const quoted = request({ id: "quoted", status: "Quoting" });
  const visible = quoteableRequests({
    requests: [open, scheduled, quoted],
    quotes: [
      {
        id: "q1",
        client: "Active Yard",
        address: "1 Test St",
        issued: "20 Sep 2026",
        expires: "04 Oct 2026",
        validDays: 14,
        status: "Sent",
        scope: "Mow",
        clientNotes: "",
        items: [],
        jobRequestId: "quoted",
      },
    ],
  });
  assert.deepEqual(
    visible.map((item) => item.id),
    ["open"],
  );
});

test("schedulableRequests drops closed and already scheduled requests", () => {
  const visible = schedulableRequests([
    request({ id: "new", status: "New" }),
    request({ id: "sched", status: "Scheduled" }),
    request({ id: "closed", status: "Closed" }),
  ]);
  assert.deepEqual(
    visible.map((item) => item.id),
    ["new"],
  );
});

test("scope helpers split stored text and fall back to line items", () => {
  assert.deepEqual(scopeLinesFromText("Mow lawn\nEdge paths"), [
    "Mow lawn",
    "Edge paths",
  ]);
  assert.deepEqual(
    scopeLinesFromText("  ", [{ description: "Labour", quantity: 1, rate: 80 }]),
    ["Labour"],
  );
  assert.equal(
    scopeTextFromInvoice({
      scope: ["Mow lawn", "Edge paths"],
      items: [],
    }),
    "Mow lawn\nEdge paths",
  );
});
