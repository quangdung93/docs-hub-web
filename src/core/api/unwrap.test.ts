/**
 * Self-check for the envelope unwrapper — the one place that decides whether a
 * backend response is a success. Run with:
 *   npx tsx src/core/api/unwrap.test.ts
 *
 * The case that matters most is a business failure arriving on HTTP 200: axios
 * resolves it, so if `unwrap` did not throw, a failed delete would look
 * identical to a successful one.
 */
import assert from 'node:assert/strict';

import { z } from 'zod';

import { AppError } from './errors';
import { unwrap, unwrapPaginated } from './unwrap';

const Item = z.object({ id: z.string(), name: z.string() });
const meta = { request_id: 'r1', trace_id: 't1', timestamp: '2026-01-01T00:00:00Z' };

// Happy path: payload is parsed and returned.
assert.deepEqual(
  unwrap({ success: true, data: { id: 'p1', name: 'KYC' }, error: null, meta }, Item),
  { id: 'p1', name: 'KYC' }
);

// THE critical case — success:false on an HTTP 200 must throw, not return.
const businessFailure = {
  success: false,
  data: null,
  error: {
    code: 'CONFIRM_NAME_MISMATCH',
    message: 'Tên xác nhận không khớp',
    details: null,
    retryable: true,
  },
  meta,
};
assert.throws(
  () => unwrap(businessFailure, Item),
  (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'CONFIRM_NAME_MISMATCH');
    assert.equal(error.isBusiness, true, 'business failures must be flagged as such');
    assert.equal(error.retryable, true);
    assert.equal(error.message, 'Tên xác nhận không khớp');
    return true;
  }
);

// Contract drift fails loudly here rather than surfacing as undefined in a view.
assert.throws(
  () => unwrap({ success: true, data: { id: 'p1' }, error: null, meta }, Item),
  (error: unknown) => error instanceof AppError && /Unexpected response shape/.test(error.message)
);

// A garbage body is an error, not a crash.
assert.throws(() => unwrap('not an envelope', Item), AppError);

// Validation details survive so forms can map them onto fields.
try {
  unwrap(
    {
      success: false,
      data: null,
      error: { code: 'REQ_400', message: 'invalid', details: { Name: 'Trường bắt buộc' } },
      meta,
    },
    Item
  );
  assert.fail('expected a throw');
} catch (error) {
  assert.ok(error instanceof AppError);
  assert.equal(error.fieldError('Name'), 'Trường bắt buộc');
  assert.equal(error.fieldError('Missing', 'Name'), 'Trường bắt buộc', 'falls through names');
  assert.equal(error.fieldError('Absent'), undefined);
}

// Lists: items are parsed and pagination is carried through.
const page = unwrapPaginated(
  {
    success: true,
    data: [{ id: 'p1', name: 'A' }],
    error: null,
    meta: {
      ...meta,
      pagination: {
        page: 2,
        limit: 20,
        total_items: 25,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      },
    },
  },
  Item
);
assert.equal(page.items.length, 1);
assert.equal(page.pagination?.total_items, 25);
assert.equal(page.pagination?.has_prev, true);

// An empty list may legitimately come back as `data: null`.
assert.deepEqual(unwrapPaginated({ success: true, data: null, error: null, meta }, Item).items, []);

console.log('unwrap: all assertions passed');
