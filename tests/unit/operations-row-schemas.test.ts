import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  addressRowSchema,
  parseAddressLookups,
  lineItemRowSchema,
} from "../../src/features/console/data/operations-row-schemas";
import { formFieldSchema } from "../../src/features/console/data/questionnaire-contract";

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

test("parseAddressLookups: 8th property with a null label does not 500 the console home", () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({
    id: uuid(index),
    label: index === 7 ? null : `Property ${index + 1}`,
    line_1: `${index + 1} Test Street, Kingaroy`,
  }));

  const broken = z.object({
    id: z.uuid(),
    label: z.string(),
    line_1: z.string(),
  });
  const brokenResult = z.array(broken).safeParse(rows);
  assert.equal(brokenResult.success, false);
  if (!brokenResult.success) {
    assert.equal(brokenResult.error.issues[0]?.path.join("."), "7.label");
    assert.match(brokenResult.error.message, /expected string, received null/);
  }

  const lookups = parseAddressLookups(rows);
  assert.equal(lookups.size, 8);
  assert.equal(lookups.get(uuid(7))?.label, "8 Test Street, Kingaroy");
  assert.equal(lookups.get(uuid(7))?.line1, "8 Test Street, Kingaroy");
  assert.equal(lookups.get(uuid(0))?.label, "Property 1");
});

test("addressRowSchema accepts missing and blank labels", () => {
  const parsed = addressRowSchema.parse({
    id: uuid(1),
    label: "   ",
    line_1: "9 Test Street, Kingaroy",
  });
  assert.equal(parsed.label?.trim() || parsed.line_1, "9 Test Street, Kingaroy");

  const unlabeled = addressRowSchema.parse({
    id: uuid(2),
    line_1: "11 Test Street, Kingaroy",
  });
  assert.equal(unlabeled.label ?? null, null);
});

test("lineItemRowSchema accepts null unit labels from Postgres", () => {
  const parsed = lineItemRowSchema.parse({
    label: null,
    description: "Mow lawn",
    quantity: "1",
    unit_label: null,
    unit_price: "85",
  });
  assert.equal(parsed.description, "Mow lawn");
  assert.equal(parsed.unit_label, null);
  assert.equal(parsed.quantity, 1);
});

test("formFieldSchema still coerces a null questionnaire label", () => {
  const parsed = z.array(formFieldSchema).parse([
    { id: "q1", label: "Beds", type: "text" },
    { id: "q2", label: null, type: "textarea" },
  ]);
  assert.equal(parsed[1]?.label, "Untitled");
});
