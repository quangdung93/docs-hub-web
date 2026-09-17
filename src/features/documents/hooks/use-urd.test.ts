/**
 * Self-check cho việc làm tiếp một phân tích đang dở.
 * Chạy bằng `npx tsx src/features/documents/hooks/use-urd.test.ts`.
 *
 * Bối cảnh: người dùng giải quyết 3/15 case rồi đóng modal. Mở lại mà gọi
 * `analyze` thì backend trả `URD_ANALYSIS_ACTIVE` kèm `success:false`, Zod ném
 * lỗi và cả màn hình vỡ — đúng lỗi gặp ngày 17/09/2026.
 */
import assert from 'node:assert/strict';

import { AppError } from '@/core/api';

import { activeAnalysisId } from './use-urd';

const ACTIVE = '1cdd571a-cfff-4211-baa9-36dc54a956ed';

// Hình dạng lỗi lấy nguyên từ phản hồi thật của api.docshub.io.vn.
const activeError = new AppError({
  code: 'URD_ANALYSIS_ACTIVE',
  message: 'Tài liệu đang có phân tích edge case chưa hoàn tất',
  status: 200,
  details: { analysis_id: ACTIVE },
  isBusiness: true,
});
assert.equal(activeAnalysisId(activeError), ACTIVE, 'phải lấy được analysis_id để mở lại');

// Mọi lỗi khác phải trả null để nơi gọi ném tiếp, không nuốt lỗi thật.
assert.equal(
  activeAnalysisId(
    new AppError({ code: 'REQ_400', message: 'Nguồn canonical chưa sẵn sàng', status: 400 })
  ),
  null
);
assert.equal(
  activeAnalysisId(
    new AppError({ code: 'URD_NOT_CONFIRMED', message: 'Chưa xác nhận', status: 200 })
  ),
  null
);

// Đúng mã lỗi nhưng thiếu/hỏng `details` thì vẫn phải là null, không được trả
// chuỗi rỗng rồi đi gọi GET với id rỗng.
for (const details of [undefined, {}, { analysis_id: '' }, { analysis_id: 42 }]) {
  assert.equal(
    activeAnalysisId(
      new AppError({
        code: 'URD_ANALYSIS_ACTIVE',
        message: 'x',
        status: 200,
        details: details as Record<string, unknown> | undefined,
      })
    ),
    null,
    `details=${JSON.stringify(details)} phải cho null`
  );
}

// Không phải AppError thì không được ném.
assert.equal(activeAnalysisId(new Error('Network Error')), null);
assert.equal(activeAnalysisId(null), null);
assert.equal(activeAnalysisId(undefined), null);
assert.equal(activeAnalysisId('URD_ANALYSIS_ACTIVE'), null);

console.log('use-urd: all assertions passed');
