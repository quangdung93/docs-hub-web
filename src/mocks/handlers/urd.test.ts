/** Kiểm chứng luồng URD chạy thật qua MSW: chưa xác nhận → xác nhận → phân tích → lưu. */
import { setupServer } from 'msw/node';
import assert from 'node:assert/strict';

import { handlers } from '@/mocks/handlers';

const server = setupServer(...handlers);
server.listen({ onUnhandledRequest: 'error' });

const BASE = 'http://localhost/internal/api/v1/projects/p1';
const D = 'doc-abc';
const get = async (u: string, init?: RequestInit) => (await fetch(u, init)).json();

// 1. Chưa xác nhận doc_type → phải bị từ chối bằng URD_NOT_CONFIRMED
const first = await get(`${BASE}/documents/${D}/urd/analyze`, { method: 'POST' });
assert.equal(first.success, false);
assert.equal(first.error.code, 'URD_NOT_CONFIRMED');

// 2. Tóm tắt lúc chưa phân tích: rỗng
const empty = await get(`${BASE}/documents/urd-summary`);
assert.deepEqual(empty.data, [], 'chưa phân tích thì urd-summary phải rỗng');

// 3. Xác nhận rồi phân tích
await get(`${BASE}/documents/${D}/doc-type`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ doc_type: 'urd', version: 1 }),
});
const analyzed = await get(`${BASE}/documents/${D}/urd/analyze`, { method: 'POST' });
assert.equal(analyzed.success, true);
const analysisId = analyzed.data.analysis.id;
const cases = analyzed.data.cases;
assert.ok(cases.length >= 3, 'phải có ít nhất 3 edge case');
assert.equal(analyzed.data.analysis.resolved_cases, 0);

// 4. Tóm tắt giờ phải thấy tài liệu này
const summary = await get(`${BASE}/documents/urd-summary`);
assert.equal(summary.data.length, 1);
assert.equal(summary.data[0].document_id, D);
assert.equal(summary.data[0].total_cases, cases.length);

// 5. Lưu một phần → chưa sinh revision mới
const partial = await get(`${BASE}/documents/${D}/urd/analyses/${analysisId}/resolutions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ items: [{ case_id: cases[0].id, resolution: 'Chặn sau 5 lần sai.' }] }),
});
assert.equal(partial.data.analysis.resolved_cases, 1);
assert.equal(partial.data.new_revision_created, false, 'mới giải quyết 1 case thì chưa đủ');

// 6. Lưu hết → sinh revision mới
const all = await get(`${BASE}/documents/${D}/urd/analyses/${analysisId}/resolutions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    items: cases.map((c: { id: string }) => ({ case_id: c.id, resolution: 'Đã xử lý.' })),
  }),
});
assert.equal(all.data.analysis.resolved_cases, cases.length);
assert.equal(all.data.new_revision_created, true, 'giải quyết hết thì phải sinh revision mới');

// 7. urd-summary phản ánh 100%
const done = await get(`${BASE}/documents/urd-summary`);
assert.equal(done.data[0].resolved_cases, cases.length);

// 8. Làm nhiều đợt: đang dở mà gọi `analyze` lần nữa phải bị từ chối bằng
//    URD_ANALYSIS_ACTIVE kèm analysis_id, chứ không tạo lần chạy mới đè lên.
const D2 = 'doc-multi';
await get(`${BASE}/documents/${D2}/doc-type`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ doc_type: 'urd', version: 1 }),
});
const run1 = await get(`${BASE}/documents/${D2}/urd/analyze`, { method: 'POST' });
const run1Id = run1.data.analysis.id;
const run1Cases = run1.data.cases;

// Giải quyết đúng 1 case rồi "đóng modal".
await get(`${BASE}/documents/${D2}/urd/analyses/${run1Id}/resolutions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ items: [{ case_id: run1Cases[0].id, resolution: 'đợt 1' }] }),
});

const blocked = await get(`${BASE}/documents/${D2}/urd/analyze`, { method: 'POST' });
assert.equal(blocked.success, false, 'đang dở thì không được tạo phân tích mới');
assert.equal(blocked.error.code, 'URD_ANALYSIS_ACTIVE');
assert.equal(blocked.error.details.analysis_id, run1Id, 'phải chỉ ra analysis đang dở');

// Mở lại bằng GET: công sức đợt 1 còn nguyên.
const reopened = await get(`${BASE}/documents/${D2}/urd/analyses/${run1Id}`);
assert.equal(reopened.data.analysis.resolved_cases, 1);
assert.equal(
  reopened.data.cases.find((c: { id: string }) => c.id === run1Cases[0].id).resolution,
  'đợt 1'
);

// Làm tiếp đợt 2 chỉ gửi case mới — backend cộng dồn, không xoá đợt 1.
await get(`${BASE}/documents/${D2}/urd/analyses/${run1Id}/resolutions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ items: [{ case_id: run1Cases[1].id, resolution: 'đợt 2' }] }),
});
const after = await get(`${BASE}/documents/${D2}/urd/analyses/${run1Id}`);
assert.equal(after.data.analysis.resolved_cases, 2, 'hai đợt phải cộng dồn');
assert.equal(
  after.data.cases.find((c: { id: string }) => c.id === run1Cases[0].id).resolution,
  'đợt 1'
);

server.close();
console.log(`urd-flow: all assertions passed (${cases.length} cases, lam tiep nhieu dot OK)`);
