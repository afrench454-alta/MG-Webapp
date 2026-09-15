import { z } from "zod";

import type { Client } from "../domain";
import {
  clientMutationSchema,
  type ClientMutationInput,
} from "./client-contract";

export const CLIENT_IMPORT_LIMITS = {
  maxChars: 400_000,
  maxRows: 200,
} as const;

const SHARED_INBOXES = new Set([
  "team@mowglowpropertyservices.com.au",
]);

const cadenceSchema = z.string().trim().min(1).max(120);

const importPropertySchema = z.object({
  name: z.string().trim().max(160).optional(),
  address: z.string().trim().max(500).optional(),
  cadence: cadenceSchema.optional(),
});

const looseRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    phone: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    preferred: z.string().optional(),
    notes: z.string().optional(),
    address: z.string().optional(),
    frequency: z.string().optional(),
    type: z.string().optional(),
    properties: z.array(importPropertySchema).max(50).optional(),
  })
  .passthrough();

export type ImportDecision = "create" | "skip" | "invalid";

export type ClientImportRow = {
  index: number;
  name: string;
  phone: string;
  decision: ImportDecision;
  reason: string;
  payload?: ClientMutationInput;
};

export type ClientImportPlan = {
  rows: ClientImportRow[];
  createCount: number;
  skipCount: number;
  invalidCount: number;
};

export function parseClientImportText(text: string):
  | { ok: true; records: unknown[] }
  | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: "The file is empty." };
  }
  if (trimmed.length > CLIENT_IMPORT_LIMITS.maxChars) {
    return {
      ok: false,
      message: "That file is too large. Use a JSON export under 400 KB.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, message: "That file is not valid JSON." };
  }

  const records = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { clients?: unknown }).clients)
      ? (parsed as { clients: unknown[] }).clients
      : null;

  if (!records) {
    return {
      ok: false,
      message: "JSON must be an array of clients, or { \"clients\": [...] }.",
    };
  }
  if (records.length === 0) {
    return { ok: false, message: "No clients were found in that file." };
  }
  if (records.length > CLIENT_IMPORT_LIMITS.maxRows) {
    return {
      ok: false,
      message: `Import at most ${CLIENT_IMPORT_LIMITS.maxRows} clients at a time.`,
    };
  }

  return { ok: true, records };
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (digits.startsWith("61") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function titleCaseStatus(value: string | undefined): ClientMutationInput["status"] {
  const normalized = (value || "Lead").trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "inactive") return "Inactive";
  return "Lead";
}

function titleCasePreferred(
  value: string | undefined,
): ClientMutationInput["preferred"] {
  const normalized = (value || "Phone").trim().toLowerCase();
  if (normalized === "email") return "Email";
  if (normalized === "sms") return "SMS";
  return "Phone";
}

function mapIncomingRecord(
  raw: unknown,
  index: number,
): { ok: true; payload: ClientMutationInput } | { ok: false; reason: string; name: string; phone: string } {
  const parsed = looseRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "This row is not a client object.",
      name: `Row ${index + 1}`,
      phone: "",
    };
  }

  const record = parsed.data;
  const name = (record.name || "").trim();
  const phone = String(record.phone ?? "").trim();
  const email = (record.email || "").trim();

  const properties =
    record.properties && record.properties.length > 0
      ? record.properties
          .map((property) => ({
            name: (property.name || "").trim(),
            address: (property.address || "").trim(),
            cadence: (property.cadence || record.frequency || "One-off").trim() || "One-off",
          }))
          .filter((property) => property.name || property.address)
      : record.address
        ? [
            {
              name: (record.address || "Property").trim().slice(0, 160),
              address: record.address.trim(),
              cadence: (record.frequency || "One-off").trim() || "One-off",
            },
          ]
        : [];

  const notesParts = [
    record.notes?.trim() || "",
    record.type ? `${record.type} client.` : "",
  ].filter(Boolean);

  const candidate = {
    id: `import-${index + 1}`,
    name,
    status: titleCaseStatus(record.status),
    phone,
    email,
    preferred: titleCasePreferred(record.preferred),
    properties,
    notes: notesParts.join(" ").trim(),
  };

  const validated = clientMutationSchema.safeParse(candidate);
  if (!validated.success) {
    return {
      ok: false,
      reason: validated.error.issues[0]?.message || "This client is missing required fields.",
      name: name || `Row ${index + 1}`,
      phone,
    };
  }

  return { ok: true, payload: validated.data };
}

function namesRelated(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;

  const leftTokens = left.split(" ").filter((token) => token.length >= 3);
  const rightTokens = right.split(" ").filter((token) => token.length >= 3);
  return Boolean(
    leftTokens[0] &&
      leftTokens[0] === rightTokens[0] &&
      leftTokens[0].length >= 4,
  );
}

export function matchExistingClient(
  payload: ClientMutationInput,
  existing: Client[],
): Client | undefined {
  const name = normalizeName(payload.name);
  const phone = normalizePhone(payload.phone);
  const email = normalizeEmail(payload.email);
  const usableEmail = email && !SHARED_INBOXES.has(email);

  return existing.find((client) => {
    const existingName = normalizeName(client.name);
    const existingPhone = normalizePhone(client.phone);
    const existingEmail = normalizeEmail(client.email);

    if (phone && existingPhone && phone === existingPhone) return true;
    if (namesRelated(name, existingName)) return true;
    if (usableEmail && existingEmail === email && !SHARED_INBOXES.has(existingEmail)) {
      return true;
    }
    return false;
  });
}

export function planClientImport(
  records: unknown[],
  existing: Client[],
): ClientImportPlan {
  const rows: ClientImportRow[] = [];
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();
  const known = [...existing];

  records.forEach((record, index) => {
    const mapped = mapIncomingRecord(record, index);
    if (!mapped.ok) {
      rows.push({
        index,
        name: mapped.name,
        phone: mapped.phone,
        decision: "invalid",
        reason: mapped.reason,
      });
      return;
    }

    const payload = mapped.payload;
    const phoneKey = normalizePhone(payload.phone);
    const nameKey = normalizeName(payload.name);

    if (phoneKey && seenPhones.has(phoneKey)) {
      rows.push({
        index,
        name: payload.name,
        phone: payload.phone,
        decision: "skip",
        reason: "Duplicate phone in this file.",
        payload,
      });
      return;
    }
    if (nameKey && seenNames.has(nameKey)) {
      rows.push({
        index,
        name: payload.name,
        phone: payload.phone,
        decision: "skip",
        reason: "Duplicate name in this file.",
        payload,
      });
      return;
    }

    const matched = matchExistingClient(payload, known);
    if (matched) {
      rows.push({
        index,
        name: payload.name,
        phone: payload.phone,
        decision: "skip",
        reason: `Already logged as ${matched.name}.`,
        payload,
      });
      return;
    }

    if (phoneKey) seenPhones.add(phoneKey);
    if (nameKey) seenNames.add(nameKey);
    known.push({
      id: payload.id,
      name: payload.name,
      status: payload.status,
      phone: payload.phone,
      email: payload.email,
      preferred: payload.preferred,
      properties: payload.properties,
      notes: payload.notes,
    });

    rows.push({
      index,
      name: payload.name,
      phone: payload.phone,
      decision: "create",
      reason: "New client.",
      payload,
    });
  });

  return {
    rows,
    createCount: rows.filter((row) => row.decision === "create").length,
    skipCount: rows.filter((row) => row.decision === "skip").length,
    invalidCount: rows.filter((row) => row.decision === "invalid").length,
  };
}
