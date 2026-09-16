import test from "node:test";
import assert from "node:assert/strict";

import type { Client, Invoice, Job, Quote } from "../../src/features/console/domain";
import {
  JOSEPH_DRAFT_INVOICE_CONFIRM,
  NEXT_STOP_ACTION_CHIPS,
  NEXT_STOP_OPS_STATUSES,
  buildNextStopBrief,
  canConfirmDraftInvoice,
  formatNextStopToolReply,
  linkedAcceptedQuote,
  nextStopOpsStatus,
  nextStopToolCall,
  pickNextStopJob,
  stripJobOpsSentinel,
  tagJobOpsNotes,
} from "../../src/features/console/data/joseph-next-stop";

const CLIENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const PROPERTY_ID = "987fcdeb-51a2-43f7-9876-543210fedcba";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const LATER_JOB_ID = "55555555-5555-4555-8555-555555555555";
const QUOTE_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: JOB_ID,
    displayName: "Northside Studio · Owner Residence · 11 Aug 2026",
    clientId: CLIENT_ID,
    serviceAddressId: PROPERTY_ID,
    jobRequestId: REQUEST_ID,
    client: "Northside Studio",
    property: "Owner Residence",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services",
    scope: "Regular studio clean",
    date: "11 Aug 2026",
    time: "9:00 am",
    dateKey: "2026-08-11T09:00",
    status: "scheduled",
    notes: "Gate code 4451. Dog in backyard.",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
    ...overrides,
  };
}

function client(): Client {
  return {
    id: CLIENT_ID,
    name: "Northside Studio",
    status: "Active",
    phone: "+61 400 000 000",
    email: "admin@example.com",
    preferred: "SMS",
    properties: [
      {
        id: PROPERTY_ID,
        name: "Owner Residence",
        address: "7 McCauley Drive, Booie",
        cadence: "Weekly",
      },
    ],
    notes: "Prefers morning visits.",
  };
}

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: QUOTE_ID,
    documentNumber: "Q-00012",
    clientId: CLIENT_ID,
    serviceAddressId: PROPERTY_ID,
    jobRequestId: REQUEST_ID,
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    issued: "05 Aug 2026",
    expires: "19 Aug 2026",
    validDays: 14,
    status: "Accepted",
    scope: "Regular studio clean",
    clientNotes: "",
    items: [
      { description: "Labour", quantity: 2.5, unitLabel: "hrs", rate: 120 },
      { description: "Carpet clean", quantity: 1, unitLabel: "ea", rate: 10 },
    ],
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    clientId: CLIENT_ID,
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    issued: "01 Aug 2026",
    due: "08 Aug 2026",
    documentStatus: "Issued",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Prior visit", quantity: 1, rate: 150 }],
    ...overrides,
  };
}

test("ops status names are the five field states", () => {
  assert.deepEqual([...NEXT_STOP_OPS_STATUSES], [
    "Scheduled",
    "En route",
    "Running late",
    "In progress",
    "Done",
  ]);
});

test("nextStopOpsStatus picks one label from live job state", () => {
  assert.equal(nextStopOpsStatus("scheduled"), "Scheduled");
  assert.equal(nextStopOpsStatus("in-progress"), "In progress");
  assert.equal(nextStopOpsStatus("completed"), "Done");
  assert.equal(nextStopOpsStatus("scheduled", "En route"), "En route");
  assert.equal(nextStopOpsStatus("scheduled", "Running late"), "Running late");
  assert.equal(nextStopOpsStatus("scheduled", "Done"), "Done");
  assert.equal(nextStopOpsStatus("completed", "En route"), "Done");
});

test("nextStopOpsStatus reads persisted En route and Running late from job notes", () => {
  assert.equal(
    nextStopOpsStatus("scheduled", null, "[[joseph-ops:en-route]]\nGate code 4451."),
    "En route",
  );
  assert.equal(
    nextStopOpsStatus("scheduled", null, "[[joseph-ops:running-late]]"),
    "Running late",
  );
  assert.equal(
    nextStopOpsStatus("in-progress", null, "[[joseph-ops:en-route]]\nGate code"),
    "En route",
  );
  assert.equal(
    nextStopOpsStatus("completed", null, "[[joseph-ops:en-route]]"),
    "Done",
  );
  assert.equal(
    nextStopOpsStatus("scheduled", "Running late", "[[joseph-ops:en-route]]"),
    "Running late",
  );
});

test("pickNextStopJob prefers the current in-progress job", () => {
  const next = pickNextStopJob([
    job({ id: LATER_JOB_ID, dateKey: "2026-08-10T08:00", status: "scheduled" }),
    job({ status: "in-progress", dateKey: "2026-08-11T09:00" }),
    job({ id: "66666666-6666-4666-8666-666666666666", status: "completed" }),
  ]);
  assert.equal(next?.id, JOB_ID);
  assert.equal(next?.status, "in-progress");
});

test("pickNextStopJob falls back to the earliest open job", () => {
  const next = pickNextStopJob([
    job({ id: LATER_JOB_ID, dateKey: "2026-08-12T11:00", status: "scheduled" }),
    job({ dateKey: "2026-08-11T09:00", status: "scheduled" }),
  ]);
  assert.equal(next?.id, JOB_ID);
});

test("pickNextStopJob returns nothing when the board is clear", () => {
  assert.equal(pickNextStopJob([job({ status: "completed" })]), undefined);
  assert.equal(pickNextStopJob([job({ status: "cancelled" })]), undefined);
  assert.equal(pickNextStopJob([]), undefined);
});

test("buildNextStopBrief includes name, address, notes, job scope, and outstanding balance", () => {
  const brief = buildNextStopBrief({
    jobs: [job()],
    clients: [client()],
    invoices: [
      invoice(),
      invoice({
        id: "inv-paid",
        paymentStatus: "Paid",
        items: [{ description: "Settled", quantity: 1, rate: 999 }],
      }),
    ],
    quotes: [quote()],
  });
  assert.ok(brief);
  assert.equal(brief.clientName, "Northside Studio");
  assert.equal(brief.address, "7 McCauley Drive, Booie");
  assert.equal(brief.scopeLine, "Cleaning Services · Regular studio clean");
  assert.equal(brief.notes, "Gate code 4451. Dog in backyard.");
  assert.equal(brief.balance, 150);
  assert.match(brief.balanceLabel, /150/);
  assert.equal(brief.outstandingCount, 1);
  assert.equal(brief.opsStatus, "Scheduled");
  assert.equal(brief.hasLinkedQuote, true);
  assert.equal(brief.quoteId, QUOTE_ID);
});

test("buildNextStopBrief reads persisted En route from notes without an overlay", () => {
  const brief = buildNextStopBrief({
    jobs: [
      job({
        status: "in-progress",
        notes: "[[joseph-ops:en-route]]\nGate code 4451. Dog in backyard.",
      }),
    ],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
  });
  assert.ok(brief);
  assert.equal(brief.opsStatus, "En route");
  assert.equal(brief.notes, "Gate code 4451. Dog in backyard.");
  assert.equal(brief.jobNotes, "Gate code 4451. Dog in backyard.");
  assert.equal(stripJobOpsSentinel(brief.notes).includes("[[joseph-ops"), false);
});

test("buildNextStopBrief reads persisted Running late from notes without an overlay", () => {
  const brief = buildNextStopBrief({
    jobs: [job({ notes: "[[joseph-ops:running-late]]\nGate code 4451. Dog in backyard." })],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
  });
  assert.ok(brief);
  assert.equal(brief.opsStatus, "Running late");
  assert.equal(brief.notes, "Gate code 4451. Dog in backyard.");
});

test("technicians only see an assigned next stop", () => {
  const assigned = job({
    id: LATER_JOB_ID,
    dateKey: "2026-08-12T11:00",
    assigneeIds: ["tech-1"],
  });
  const brief = buildNextStopBrief({
    jobs: [job({ assigneeIds: ["other"] }), assigned],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
    actorId: "tech-1",
    actorRole: "technician",
  });
  assert.equal(brief?.jobId, LATER_JOB_ID);
});

test("buildNextStopBrief says none when there is no current or next job", () => {
  assert.equal(
    buildNextStopBrief({
      jobs: [job({ status: "completed" })],
      clients: [client()],
      invoices: [],
      quotes: [],
    }),
    null,
  );
});

test("linkedAcceptedQuote is the job-request quote, not a last-quote rate fallback", () => {
  const other = quote({
    id: "77777777-7777-4777-8777-777777777777",
    jobRequestId: "88888888-8888-4888-8888-888888888888",
    items: [{ description: "Old rate", quantity: 1, rate: 40 }],
  });
  assert.equal(linkedAcceptedQuote(job(), [other, quote()])?.id, QUOTE_ID);
  assert.equal(linkedAcceptedQuote(job({ jobRequestId: null }), [quote()]), undefined);
  assert.equal(linkedAcceptedQuote(job(), [quote({ status: "Sent" })]), undefined);
});

test("action chips are On my way, Running late, and Done → Draft invoice", () => {
  assert.deepEqual(
    NEXT_STOP_ACTION_CHIPS.map((chip) => chip.label),
    ["On my way", "Running late", "Done → Draft invoice"],
  );
  assert.equal(JOSEPH_DRAFT_INVOICE_CONFIRM, "Draft invoice");
});

test("On my way persists En route via update_job_status, not draft-only", () => {
  const brief = buildNextStopBrief({
    jobs: [job()],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
  });
  assert.ok(brief);

  const onMyWay = nextStopToolCall("on-my-way", brief);
  assert.equal(onMyWay.name, "update_job_status");
  assert.equal(onMyWay.args.jobId, JOB_ID);
  assert.equal(onMyWay.args.status, "in-progress");
  assert.equal(onMyWay.args.confirm, true);
  assert.equal(String(onMyWay.args.notes), tagJobOpsNotes(brief.jobNotes, "En route"));
  assert.match(String(onMyWay.args.notes), /\[\[joseph-ops:en-route\]\]/);
  assert.match(String(onMyWay.args.notes), /Gate code 4451/);
  assert.equal("sent" in onMyWay.args, false);
});

test("Running late persists Running late via update_job_status and keeps scheduled", () => {
  const brief = buildNextStopBrief({
    jobs: [job()],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
  });
  assert.ok(brief);

  const runningLate = nextStopToolCall("running-late", brief);
  assert.equal(runningLate.name, "update_job_status");
  assert.equal(runningLate.args.status, "scheduled");
  assert.equal(runningLate.args.confirm, true);
  assert.match(String(runningLate.args.notes), /\[\[joseph-ops:running-late\]\]/);
  assert.match(String(runningLate.args.notes), /Gate code 4451/);
});

test("Running late keeps in-progress when the job is already En route", () => {
  const brief = buildNextStopBrief({
    jobs: [
      job({
        status: "in-progress",
        notes: "[[joseph-ops:en-route]]\nGate code 4451. Dog in backyard.",
      }),
    ],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
  });
  assert.ok(brief);
  assert.equal(brief.opsStatus, "En route");

  const runningLate = nextStopToolCall("running-late", brief);
  assert.equal(runningLate.name, "update_job_status");
  assert.equal(runningLate.args.status, "in-progress");
  assert.match(String(runningLate.args.notes), /\[\[joseph-ops:running-late\]\]/);
  assert.equal(String(runningLate.args.notes).includes("en-route"), false);
});

test("Done → Draft invoice wires complete_job_and_draft_invoice from the linked quote", () => {
  const brief = buildNextStopBrief({
    jobs: [job()],
    clients: [client()],
    invoices: [],
    quotes: [quote()],
  });
  assert.ok(brief);
  assert.equal(canConfirmDraftInvoice(brief), true);

  const preview = nextStopToolCall("done-draft-invoice", brief, false);
  assert.equal(preview.name, "complete_job_and_draft_invoice");
  assert.equal(preview.args.jobId, JOB_ID);
  assert.equal(preview.args.confirm, false);
  assert.equal("rate" in preview.args, false);

  const confirmed = nextStopToolCall("done-draft-invoice", brief, true);
  assert.equal(confirmed.name, "complete_job_and_draft_invoice");
  assert.equal(confirmed.args.confirm, true);
  assert.equal("rate" in confirmed.args, false);
});

test("Done → Draft invoice does not confirm without a linked accepted quote", () => {
  const brief = buildNextStopBrief({
    jobs: [job()],
    clients: [client()],
    invoices: [],
    quotes: [quote({ status: "Draft" })],
  });
  assert.ok(brief);
  assert.equal(brief.hasLinkedQuote, false);
  assert.equal(canConfirmDraftInvoice(brief), false);
});

test("message tool replies stay drafts and invoice replies mention the quote", () => {
  const message = formatNextStopToolReply(
    "on-my-way",
    JSON.stringify({
      draft: "Hi Northside Studio, I'm on my way — Mow & Glow Property Services",
      preferred: "SMS",
      phone: "+61 400 000 000",
      sent: false,
    }),
  );
  assert.match(message, /Not sent/);
  assert.match(message, /on my way/);
  assert.match(message, /En route/);

  const statusOnly = formatNextStopToolReply(
    "running-late",
    JSON.stringify({ id: JOB_ID, client: "Northside Studio", status: "scheduled" }),
  );
  assert.match(statusOnly, /Running late/);

  const invoiceReply = formatNextStopToolReply(
    "done-draft-invoice",
    JSON.stringify({ invoiceNumber: "INV-0041", jobStatus: "completed" }),
    "Completed Northside Studio and drafted invoice INV-0041.",
  );
  assert.match(invoiceReply, /INV-0041/);
});
