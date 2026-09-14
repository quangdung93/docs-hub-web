/**
 * Self-check cho phần đo độ hoàn thiện URD. Chạy bằng
 * `npx tsx src/features/documents/services/completeness.service.test.ts`.
 */
import assert from 'node:assert/strict';

import {
  analyzeDocument,
  completenessPercent,
  completenessTone,
  isUrdDocument,
  resolvedCount,
  type EdgeCase,
} from './completeness.service';

const makeCase = (resolution: string): EdgeCase => ({
  id: `c-${resolution.length}-${Math.random()}`,
  category: 'Xác thực',
  title: 'Trường hợp thử',
  resolution,
  imageName: null,
});

// ── Nhận diện URD ───────────────────────────────────────────────────────────
assert.equal(isUrdDocument({ name: 'URD_QuyTrinhKYC_v1.0.docx', fileName: null }), true);
assert.equal(isUrdDocument({ name: 'urd-mbx26-v1.8.md', fileName: null }), true);
assert.equal(
  isUrdDocument({ name: 'Tài liệu User Requirement', fileName: null }),
  true,
  'bắt cả cách viết đầy đủ, không chỉ viết tắt'
);
// Tên hiển thị không có dấu hiệu nhưng tên file thì có — vẫn phải bắt được.
assert.equal(isUrdDocument({ name: 'Tài liệu nghiệp vụ', fileName: 'URD_v2.docx' }), true);

assert.equal(isUrdDocument({ name: 'BRD-MBX26-v1.0.docx', fileName: null }), false);
assert.equal(
  isUrdDocument({ name: 'Absurdity_report.pdf', fileName: null }),
  false,
  '"urd" nằm giữa một từ khác thì không tính — đây là lý do dùng \\b'
);

// ── Phần trăm hoàn thiện ────────────────────────────────────────────────────
assert.equal(completenessPercent([]), 100, 'không có case nào nghĩa là không thiếu gì');
assert.equal(completenessPercent([makeCase(''), makeCase('')]), 0);
assert.equal(completenessPercent([makeCase('đã xử lý'), makeCase('')]), 50);
assert.equal(completenessPercent([makeCase('a'), makeCase('b'), makeCase('c')]), 100);
assert.equal(
  completenessPercent([makeCase('   '), makeCase('thật')]),
  50,
  'chuỗi toàn khoảng trắng không tính là đã giải quyết'
);

// ── Đếm số case đã xử lý ────────────────────────────────────────────────────
assert.equal(resolvedCount([makeCase('x'), makeCase(''), makeCase('y')]), 2);
assert.equal(resolvedCount([]), 0);

// ── Ngưỡng màu ──────────────────────────────────────────────────────────────
assert.equal(completenessTone(100), 'indexed');
assert.equal(completenessTone(80), 'indexed', 'đúng ngưỡng 80 là xanh');
assert.equal(completenessTone(79), 'queued');
assert.equal(completenessTone(50), 'queued', 'đúng ngưỡng 50 là vàng');
assert.equal(completenessTone(49), 'failed');
assert.equal(completenessTone(0), 'failed');

// ── Phân tích mô phỏng ──────────────────────────────────────────────────────
const doc = { id: 'd1', name: 'URD_Test.docx', fileName: 'URD_Test.docx' };
const first = await analyzeDocument(doc, { delayMs: 0 });
const second = await analyzeDocument(doc, { delayMs: 0 });

assert.ok(first.cases.length >= 3, 'luôn trả ít nhất 3 case');
assert.equal(
  first.cases.length,
  second.cases.length,
  'cùng một tài liệu phải ra cùng số case — số nhảy mỗi lần bấm sẽ lộ là dữ liệu giả'
);
assert.ok(
  first.cases.every((item) => item.resolution === '' && item.imageName === null),
  'case mới chưa có hướng giải quyết nào'
);
assert.ok(
  new Set(first.cases.map((item) => item.id)).size === first.cases.length,
  'id phải khác nhau, nếu không React sẽ render nhầm khi sửa một ô'
);

console.log('completeness.service: all assertions passed');
