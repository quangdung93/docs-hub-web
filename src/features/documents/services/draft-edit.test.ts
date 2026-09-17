/**
 * Self-check cho phép sửa bản nháp khi mở lại một phân tích đã có.
 * Chạy bằng `npx tsx src/features/documents/services/draft-edit.test.ts`.
 *
 * Lỗi gặp ngày 17/09/2026: mở lại phân tích 3/15, gõ vào những ô chưa có nội
 * dung thì không ăn ký tự nào. Bản nháp lúc đó còn rỗng (dữ liệu hiển thị là của
 * server), mà hàm sửa lại bỏ qua mọi thay đổi khi bản nháp rỗng.
 */
import assert from 'node:assert/strict';

import { type EdgeCase, type UrdAnalysis } from './completeness.service';

type Draft = { documentId: string | null; value: UrdAnalysis | null };

/** Bản rút gọn đúng logic trong `edge-case-modal.tsx`. */
function updateCase(
  draft: Draft,
  server: UrdAnalysis | undefined,
  id: string,
  patch: Partial<EdgeCase>
): Draft {
  const base = draft.value ?? server;
  if (!base) return draft;
  return {
    documentId: draft.documentId,
    value: {
      ...base,
      cases: base.cases.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    },
  };
}

const makeCase = (id: string, resolution: string): EdgeCase => ({
  id,
  description: `case ${id}`,
  sequenceNo: Number(id.replace('c', '')),
  resolution,
  imageObjectKey: null,
});

const server: UrdAnalysis = {
  analysis: {
    id: 'a1',
    documentId: 'd1',
    status: 'awaiting_input',
    totalCases: 3,
    resolvedCases: 1,
    errorDetail: null,
    createdAt: null,
  },
  cases: [makeCase('c1', 'đã nhập trước'), makeCase('c2', ''), makeCase('c3', '')],
};

// Mở lại: bản nháp rỗng, dữ liệu đến từ server.
const empty: Draft = { documentId: 'd1', value: null };

// Gõ vào ô CHƯA có nội dung — đây chính là trường hợp từng bị nuốt.
const typed = updateCase(empty, server, 'c2', { resolution: 'n' });
assert.ok(typed.value, 'lần gõ đầu phải gieo được bản nháp từ dữ liệu server');
assert.equal(typed.value!.cases[1]!.resolution, 'n', 'ký tự vừa gõ phải được giữ lại');
assert.equal(typed.value!.cases[0]!.resolution, 'đã nhập trước', 'case cũ phải còn nguyên');

// Gõ tiếp: lần này bản nháp đã có, phải cộng dồn chứ không reset.
const typedMore = updateCase(typed, server, 'c2', { resolution: 'nội dung đầy đủ' });
assert.equal(typedMore.value!.cases[1]!.resolution, 'nội dung đầy đủ');
assert.equal(typedMore.value!.cases[0]!.resolution, 'đã nhập trước');

// Sửa một ô khác không được xoá ô vừa gõ.
const another = updateCase(typedMore, server, 'c3', { resolution: 'ô thứ ba' });
assert.equal(another.value!.cases[1]!.resolution, 'nội dung đầy đủ', 'ô c2 phải còn');
assert.equal(another.value!.cases[2]!.resolution, 'ô thứ ba');

// Đính ảnh cũng phải gieo được bản nháp y như gõ chữ.
const withImage = updateCase(empty, server, 'c3', { imageObjectKey: 'obj/x.png' });
assert.equal(withImage.value!.cases[2]!.imageObjectKey, 'obj/x.png');

// Chưa có cả server lẫn nháp thì giữ nguyên, không được ném.
assert.equal(updateCase(empty, undefined, 'c2', { resolution: 'x' }).value, null);

console.log('draft-edit: all assertions passed');
