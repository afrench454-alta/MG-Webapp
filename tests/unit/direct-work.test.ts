import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteDraftSchema, scheduleJobSchema } from '../../src/features/console/data/operations-contract';

const clientId = '123e4567-e89b-12d3-a456-426614174000';
const propertyId = '987fcdeb-51a2-43f7-9876-543210fedcba';
const draft = { scope: 'Edge path', items: [{ description: 'Edge path', rate: 40, quantity: 1 }], clientNotes: '', internalNotes: '' };
const visit = { category: 'Yard Services', scheduledStart: '2026-11-20T09:00:00+10:00' };

test('a direct draft quote accepts an inline customer with only a name', () => {
  assert.equal(quoteDraftSchema.safeParse({ ...draft, inlineClient: { name: 'Example Customer' } }).success, true);
});

test('a direct quote requires mutually exclusive customer sources', () => {
  assert.equal(quoteDraftSchema.safeParse({ ...draft, clientId, inlineClient: { name: 'Example Customer' } }).success, false);
});

test('a job-card quote uses the job as its only source', () => {
  assert.equal(quoteDraftSchema.safeParse({ ...draft, directJobId: propertyId }).success, true);
  assert.equal(quoteDraftSchema.safeParse({ ...draft, directJobId: propertyId, clientId }).success, false);
  assert.equal(quoteDraftSchema.safeParse({ ...draft, directJobId: propertyId, id: clientId }).success, false);
});

test('a direct calendar job requires a service address', () => {
  assert.equal(scheduleJobSchema.safeParse({ ...visit, clientId, propertyId }).success, true);
  assert.equal(scheduleJobSchema.safeParse({ ...visit, clientId }).success, false);
  assert.equal(scheduleJobSchema.safeParse({ ...visit, inlineClient: { name: 'Example Customer' } }).success, false);
});

test('a quote keeps the chosen expiry and rejects expiry before issue', () => {
  assert.equal(quoteDraftSchema.parse({ ...draft, clientId, issueDate: '2026-11-10', validUntil: '2026-12-12' }).validUntil, '2026-12-12');
  assert.equal(quoteDraftSchema.safeParse({ ...draft, clientId, issueDate: '2026-11-10', validUntil: '2026-11-09' }).success, false);
});
