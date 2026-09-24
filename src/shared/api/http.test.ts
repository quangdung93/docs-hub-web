/**
 * Self-check cho việc từ chối lỗi nghiệp vụ ngay tại transport.
 * Chạy bằng `npx tsx src/shared/api/http.test.ts`.
 *
 * Backend báo thất bại nghiệp vụ bằng HTTP 200 + `success:false`. Trước đây
 * interceptor cho qua, và call site nào parse thẳng bằng `apiSuccessSchema`
 * (24 chỗ, trong đó có upload) đều hiện ra khối lỗi Zod
 * "expected true / expected object, received null" thay vì câu của backend.
 * Gặp hai lần: phân tích edge case đang dở (17/09) và upload trùng nội dung (24/09).
 */
import assert from 'node:assert/strict';

import { type AxiosAdapter } from 'axios';

import { AppError } from '@/core/api/errors';

import { http } from './http';

/** Adapter giả: trả nguyên body với mã HTTP cho trước, không đi ra mạng. */
const reply =
  (body: unknown, status = 200): AxiosAdapter =>
  async (config) => ({ data: body, status, statusText: 'OK', headers: {}, config });

// Body lấy nguyên từ api.docshub.io.vn ngày 24/09/2026.
const duplicate = {
  success: false,
  data: null,
  error: {
    code: 'DUPLICATE_CONTENT',
    message: 'Nội dung file này đã tồn tại trong phạm vi đã chọn',
    retryable: false,
  },
  meta: { request_id: 'x', trace_id: '', timestamp: '2026-09-24T00:00:00Z' },
};

// 1. HTTP 200 + success:false phải thành AppError mang đúng mã và câu của backend.
await assert.rejects(http.post('/upload', {}, { adapter: reply(duplicate) }), (error: unknown) => {
  assert.ok(error instanceof AppError, 'phải là AppError, không phải ZodError');
  assert.equal(error.code, 'DUPLICATE_CONTENT');
  assert.equal(error.message, 'Nội dung file này đã tồn tại trong phạm vi đã chọn');
  assert.equal(error.isBusiness, true);
  return true;
});

// 2. `details` phải đi theo — edge case dựa vào `details.analysis_id` để mở lại.
await assert.rejects(
  http.post(
    '/analyze',
    {},
    {
      adapter: reply({
        success: false,
        data: null,
        error: {
          code: 'URD_ANALYSIS_ACTIVE',
          message: 'Tài liệu đang có phân tích edge case chưa hoàn tất',
          details: { analysis_id: 'a-1' },
        },
      }),
    }
  ),
  (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.deepEqual(error.details, { analysis_id: 'a-1' });
    return true;
  }
);

// 3. Phản hồi thành công đi qua nguyên vẹn.
const ok = await http.get('/ok', { adapter: reply({ success: true, data: { id: 1 } }) });
assert.deepEqual(ok.data, { success: true, data: { id: 1 } });

// 4. Body không phải envelope (tải file dạng blob, chuỗi, null) không được bị chặn.
for (const body of ['plain text', null, { foo: 'bar' }, new Uint8Array([1, 2, 3])]) {
  const res = await http.get('/raw', { adapter: reply(body) });
  assert.equal(res.data, body, `body ${String(body)} phải đi qua nguyên vẹn`);
}

console.log('http: all assertions passed');
