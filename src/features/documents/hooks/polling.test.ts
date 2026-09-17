/**
 * Self-check cho điều kiện tự làm mới bảng tài liệu.
 * Chạy bằng `npx tsx src/features/documents/hooks/polling.test.ts`.
 *
 * Điểm cần giữ: chỉ poll khi thật sự còn việc đang chạy. Poll mãi thì bảng đứng
 * yên vẫn bắn request 5 giây một lần; không poll thì "Đang xử lý" nằm đó cho tới
 * khi người dùng tự F5 — mà không có gì trên màn hình bảo họ phải F5.
 */
import assert from 'node:assert/strict';

import { documentListQueryOptions } from './use-documents';
import { urdSummaryQueryOptions } from './use-urd';

type Row = { status: string };

/** Gọi đúng `refetchInterval` mà TanStack sẽ gọi, với dữ liệu giả. */
function intervalFor(rows: Row[] | undefined): number | false {
  const option = documentListQueryOptions('p1').refetchInterval;
  assert.equal(typeof option, 'function', 'refetchInterval phải là hàm để xét theo dữ liệu');
  return (option as (q: unknown) => number | false)({ state: { data: rows } });
}

// Còn việc đang chạy → poll.
assert.equal(intervalFor([{ status: 'processing' }]), 10_000, 'đang xử lý thì phải poll');
assert.equal(intervalFor([{ status: 'queued' }]), 10_000, 'chờ xử lý thì phải poll');
assert.equal(
  intervalFor([{ status: 'indexed' }, { status: 'processing' }]),
  10_000,
  'một dòng chưa xong là đủ để poll'
);

// Xong hết → dừng hẳn.
assert.equal(intervalFor([{ status: 'indexed' }]), false, 'xong hết thì không poll nữa');
assert.equal(
  intervalFor([{ status: 'failed' }]),
  false,
  'failed là trạng thái cuối — pipeline đã dừng, đợi thêm vô nghĩa'
);
assert.equal(
  intervalFor([{ status: 'indexed' }, { status: 'failed' }]),
  false,
  'indexed + failed đều là trạng thái cuối'
);

// Chưa có dữ liệu thì không poll, tránh bắn request trước cả lần tải đầu.
assert.equal(intervalFor(undefined), false);
assert.equal(intervalFor([]), false, 'project rỗng thì không có gì để đợi');

// urd-summary phải cùng nhịp, nếu không ô "Hoàn thiện" trễ hơn cột trạng thái.
assert.equal(urdSummaryQueryOptions('p1', true).refetchInterval, 10_000);
assert.equal(urdSummaryQueryOptions('p1', true).staleTime, 0, 'đang poll thì không được cache');
assert.equal(urdSummaryQueryOptions('p1', false).refetchInterval, false);
assert.equal(urdSummaryQueryOptions('p1').refetchInterval, false, 'mặc định là không poll');

console.log('polling: all assertions passed');
