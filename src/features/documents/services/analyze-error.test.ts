/**
 * Self-check cho việc dịch lỗi của `urd/analyze` sang câu người dùng đọc được.
 * Chạy bằng `npx tsx src/features/documents/services/analyze-error.test.ts`.
 *
 * Ba hình dạng lỗi dưới đây lấy nguyên từ phản hồi thật của api.docshub.io.vn
 * ngày 16/09/2026, nên đây là chỗ phát hiện sớm nếu backend đổi mã lỗi.
 */
import assert from 'node:assert/strict';

import { AppError } from '@/core/api';

import { analyzeErrorMessage } from '../components/edge-case-modal';

/** `t` giả: trả lại chính khóa, đủ để khẳng định nhánh nào được chọn. */
const t = ((key: string) => key) as never;

const notConfirmed = new AppError({
  code: 'URD_NOT_CONFIRMED',
  message: 'Tài liệu chưa được xác nhận là URD',
  status: 200,
  isBusiness: true,
});
assert.equal(analyzeErrorMessage(notConfirmed, t), 'edgeCase.notConfirmed');

const noCanonical = new AppError({
  code: 'REQ_400',
  message: 'Nguồn canonical của revision chưa sẵn sàng',
  status: 400,
});
assert.equal(analyzeErrorMessage(noCanonical, t), 'edgeCase.notReady');

// Lỗi lạ vẫn phải ra một câu có nghĩa chứ không phải chuỗi rỗng.
assert.equal(
  analyzeErrorMessage(new AppError({ code: 'SYS_500', message: 'Lỗi hệ thống', status: 500 }), t),
  'edgeCase.analyzeFailed'
);

// Không phải AppError (mạng đứt, lỗi parse) — không được ném ra ngoài.
assert.equal(analyzeErrorMessage(new Error('Network Error'), t), 'edgeCase.analyzeFailed');
assert.equal(analyzeErrorMessage(null, t), 'edgeCase.analyzeFailed');
assert.equal(analyzeErrorMessage(undefined, t), 'edgeCase.analyzeFailed');

console.log('analyze-error: all assertions passed');
