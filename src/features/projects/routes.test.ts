/**
 * Self-check cho bảng đường dẫn của project.
 * Chạy bằng `npx tsx src/features/projects/routes.test.ts`.
 *
 * Lý do có bài này: nút "Xong" ở màn tải tài liệu từng trỏ sang
 * `projectRoutes.chat` thay vì `documents`. Hai hàm cùng nhận `projectId` nên
 * TypeScript không thấy gì sai, và không có gì bắt được cho tới khi người dùng
 * bấm thử. Ở đây chốt lại hình dạng từng đường dẫn.
 */
import assert from 'node:assert/strict';

import { projectRoutes } from './routes';

const P = 'c996b744-fa13-4030-ab0b-f466a35be51f';

// Hai đường dẫn này khác nhau và không được lẫn: một cái là màn hỏi đáp, một
// cái là màn quản lý tài liệu.
assert.equal(projectRoutes.chat(P), `/projects/${P}`);
assert.equal(projectRoutes.documents(P), `/projects/${P}/documents`);
assert.notEqual(projectRoutes.documents(P), projectRoutes.chat(P));

// Kèm phiên bản: dùng khi quay về từ màn tải lên, để danh sách mở đúng phiên bản
// vừa chọn thay vì rơi về bản mới nhất.
const V = '8b3b6808-041d-42b2-9aeb-984f2af32641';
assert.equal(projectRoutes.documents(P, V), `/projects/${P}/documents?version=${V}`);

// Không có phiên bản (undefined hoặc chuỗi rỗng) thì không được đẻ ra `?version=`
// rỗng — màn hình sẽ đọc thành chuỗi rỗng chứ không phải "chưa chọn".
assert.equal(projectRoutes.documents(P, undefined), `/projects/${P}/documents`);
assert.equal(projectRoutes.documents(P, ''), `/projects/${P}/documents`);

// Giá trị lạ phải được mã hoá, không được phá cấu trúc query.
assert.equal(
  projectRoutes.documents(P, 'a b&c=d'),
  `/projects/${P}/documents?version=a%20b%26c%3Dd`
);

assert.equal(projectRoutes.upload(P), `/projects/${P}/documents/upload`);
assert.equal(projectRoutes.settings(P), `/projects/${P}/settings`);

console.log('routes: all assertions passed');
