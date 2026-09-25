/**
 * Self-check cho phần tính độ hoàn thiện URD. Chạy bằng
 * `npx tsx src/features/documents/services/completeness.service.test.ts`.
 *
 * Trọng tâm là ánh xạ DTO → model miền: backend để gần như mọi trường ở dạng
 * nullable, nên chỗ dễ vỡ nhất là một `null` lọt vào phép chia hoặc vào UI.
 */
import assert from 'node:assert/strict';

import {
  completenessDisplay,
  completenessPercent,
  completenessTone,
  resolvedCount,
  toAnalysis,
  toUrdSummary,
  type EdgeCase,
} from './completeness.service';

const makeCase = (resolution: string): EdgeCase => ({
  id: Math.random().toString(36).slice(2),
  description: 'mô tả',
  sequenceNo: 1,
  resolution,
  imageObjectKey: null,
});

// ── completenessPercent ────────────────────────────────────────────────────
assert.equal(completenessPercent(0, 0), 100, 'không có case nào nghĩa là không thiếu gì');
assert.equal(completenessPercent(2, 0), 0);
assert.equal(completenessPercent(2, 1), 50);
assert.equal(completenessPercent(3, 3), 100);
// Tổng âm là dữ liệu hỏng; vẫn phải cho ra số hợp lệ chứ không phải NaN.
assert.equal(completenessPercent(-1, 0), 100);

// ── resolvedCount: chỉ khoảng trắng không tính là đã giải quyết ─────────────
assert.equal(resolvedCount([makeCase('x'), makeCase(''), makeCase('y')]), 2);
assert.equal(resolvedCount([makeCase('   '), makeCase('thật')]), 1);
assert.equal(resolvedCount([]), 0);

// ── completenessTone: đúng ngưỡng ───────────────────────────────────────────
assert.equal(completenessTone(100), 'indexed');
assert.equal(completenessTone(80), 'indexed', 'đúng ngưỡng 80 là xanh');
assert.equal(completenessTone(79), 'queued');
assert.equal(completenessTone(50), 'queued', 'đúng ngưỡng 50 là vàng');
assert.equal(completenessTone(49), 'failed');
assert.equal(completenessTone(0), 'failed');

// ── toAnalysis: mọi trường nullable đều phải có giá trị thay thế ────────────
const mapped = toAnalysis({
  analysis: {
    id: 'a1',
    document_id: 'd1',
    status: 'ready',
    total_cases: null,
    resolved_cases: null,
    revision_id: null,
    created_by: null,
    error_code: null,
    error_detail: null,
    created_at: null,
    updated_at: null,
  },
  cases: null,
});
assert.equal(mapped.analysis.totalCases, 0, 'total_cases null → 0, không để undefined lọt vào UI');
assert.equal(mapped.analysis.resolvedCases, 0);
assert.deepEqual(mapped.cases, [], 'cases null → mảng rỗng để component map được ngay');

// `sequence_no` vắng mặt thì đánh số theo vị trí, nếu không cả danh sách hiện số 0.
const ordered = toAnalysis({
  analysis: { id: 'a2', document_id: 'd2', status: 'ready' },
  cases: [
    { id: 'c1', description: null, sequence_no: null, resolution: null, resolved: null },
    { id: 'c2', description: 'hai', sequence_no: 7, resolution: 'xong', resolved: true },
  ],
});
assert.equal(ordered.cases[0]!.sequenceNo, 1, 'thiếu sequence_no thì lấy theo vị trí');
assert.equal(ordered.cases[0]!.description, '');
assert.equal(ordered.cases[0]!.resolution, '');
assert.equal(ordered.cases[1]!.sequenceNo, 7, 'có sequence_no thì giữ nguyên của backend');

// ── toUrdSummary ───────────────────────────────────────────────────────────
const summary = toUrdSummary({
  document_id: 'd3',
  analysis_id: null,
  status: null,
  total_cases: null,
  resolved_cases: null,
});
assert.equal(summary.totalCases, 0);
assert.equal(summary.analysisId, null);
assert.equal(completenessPercent(summary.totalCases, summary.resolvedCases), 100);

// ── completenessDisplay: chỉ mời phân tích tài liệu đã xác nhận URD ────────
// Đã xác nhận URD + đã lập chỉ mục → mời phân tích.
assert.equal(completenessDisplay('indexed', null, 'urd'), 'analyze');
// Chưa xác nhận URD thì không bao giờ hiện nút, dù đã lập chỉ mục — trước đây
// bấm nút trên README.md là âm thầm gán nó thành URD.
assert.equal(completenessDisplay('indexed', null, null), 'empty', 'README.md không được hiện nút');
assert.equal(completenessDisplay('indexed', null, ''), 'empty');
// Là URD nhưng chưa lập chỉ mục xong: chưa có nguồn canonical, analyze chắc chắn hỏng.
for (const status of ['processing', 'queued', 'failed']) {
  assert.equal(completenessDisplay(status, null, 'urd'), 'empty', `URD đang ${status}`);
}

// Đã có kết quả thì luôn hiện, ở mọi trạng thái và kể cả khi docType chưa kịp tải.
const hasSummary = {
  documentId: 'd1',
  analysisId: 'a1',
  status: 'awaiting_input',
  totalCases: 15,
  resolvedCases: 3,
};
for (const status of ['indexed', 'processing', 'queued', 'failed']) {
  assert.equal(completenessDisplay(status, hasSummary, null), 'progress', `status=${status}`);
}

console.log('completeness: all assertions passed');
